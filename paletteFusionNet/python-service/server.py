"""
PaletteFusionNet Python 推理服务 - Flask API
供 Tauri 应用通过 HTTP 调用
"""
import os
import sys
import base64
import io
import traceback
import socket

# 修复 Windows 中文主机名导致的 UnicodeDecodeError
_orig_getfqdn = socket.getfqdn


def _safe_getfqdn(name=""):
    try:
        return _orig_getfqdn(name)
    except UnicodeDecodeError:
        return name if name else "localhost"


socket.getfqdn = _safe_getfqdn

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from collections import OrderedDict
from functools import partial, wraps
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS


def ensure_stdio_available():
    """PyInstaller --noconsole sets stdio to None; Flask still writes startup logs."""
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8", buffering=1)
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8", buffering=1)


ensure_stdio_available()

app = Flask(__name__)
CORS(app)


@app.after_request
def add_local_browser_headers(response):
    """Allow the cloud admin page to call this localhost service in modern browsers."""
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

if getattr(sys, "frozen", False):
    BASE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def safe_path(base_dir: str, filename: str) -> str:
    """Resolve filename against base_dir, preventing path traversal."""
    safe_name = os.path.basename(filename)
    full_path = os.path.realpath(os.path.join(base_dir, safe_name))
    base_real = os.path.realpath(base_dir)
    if full_path != base_real and not full_path.startswith(base_real + os.sep):
        raise ValueError(f"路径越权访问: {filename}")
    return full_path


def handle_api_errors(f):
    """Decorator to catch exceptions in Flask routes and return JSON errors."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except FileNotFoundError as e:
            return jsonify({"error": f"文件未找到: {e}"}), 404
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"服务器内部错误: {e}"}), 500
    return wrapper


# ===================== 模型定义 =====================

class Conv2dAuto(nn.Conv2d):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.padding = (self.kernel_size[0] // 2, self.kernel_size[1] // 2)

conv3x3 = partial(Conv2dAuto, kernel_size=3, bias=False)

def activation_func(activation):
    return nn.ModuleDict([
        ['relu', nn.ReLU(inplace=True)],
        ['leaky_relu', nn.LeakyReLU(negative_slope=0.01, inplace=True)],
        ['none', nn.Identity()]
    ])[activation]

class ResidualBlock(nn.Module):
    def __init__(self, in_channels, out_channels, activation='relu'):
        super().__init__()
        self.in_channels, self.out_channels, self.activation = in_channels, out_channels, activation
        self.blocks = nn.Identity()
        self.shortcut = nn.Identity()
        self.activate = activation_func(activation)

    def forward(self, x):
        residual = x
        if self.should_apply_shortcut: residual = self.shortcut(x)
        x = self.blocks(x)
        x += residual
        x = self.activate(x)
        return x

    @property
    def should_apply_shortcut(self):
        return self.in_channels != self.out_channels

class ResNetResidualBlock(ResidualBlock):
    def __init__(self, in_channels, out_channels, expansion=1, downsampling=2, conv=conv3x3, *args, **kwargs):
        super().__init__(in_channels, out_channels)
        self.expansion, self.downsampling, self.conv = expansion, downsampling, conv
        self.shortcut = nn.Sequential(OrderedDict(
            {
                'conv': nn.Conv2d(self.in_channels, self.expanded_channels, kernel_size=1,
                                  stride=self.downsampling, bias=False, padding=0),
                'bn': nn.InstanceNorm2d(self.expanded_channels)
            })) if self.should_apply_shortcut else None

    @property
    def expanded_channels(self):
        return self.out_channels * self.expansion

    @property
    def should_apply_shortcut(self):
        return self.in_channels != self.expanded_channels

def conv_bn(in_channels, out_channels, conv, *args, **kwargs):
    return nn.Sequential(OrderedDict({'conv': conv(in_channels, out_channels, *args, **kwargs),
                                      'bn': nn.InstanceNorm2d(out_channels)}))

class ResNetBasicBlock(ResNetResidualBlock):
    expansion = 1
    def __init__(self, in_channels, out_channels, *args, **kwargs):
        super().__init__(in_channels, out_channels, *args, **kwargs)
        self.blocks = nn.Sequential(
            conv_bn(self.in_channels, self.out_channels, conv=self.conv, bias=False, stride=self.downsampling),
            nn.LeakyReLU(negative_slope=0.02),
            conv_bn(self.out_channels, self.expanded_channels, conv=self.conv, bias=False),
        )

class FeatureEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Conv2d(in_channels=3, out_channels=64, kernel_size=3, stride=1, padding=1)
        self.norm = nn.InstanceNorm2d(64)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2, padding=0)
        self.res1 = ResNetBasicBlock(64, 128)
        self.res2 = ResNetBasicBlock(128, 256)
        self.res3 = ResNetBasicBlock(256, 512)

    def forward(self, x):
        x = F.relu(self.norm(self.conv(x)))
        c4 = self.pool(x)
        c3 = self.res1(c4)
        c2 = self.res2(c3)
        c1 = self.res3(c2)
        return c1, c2, c3, c4

def de_conv(in_channels, out_channels, kernel_size=3):
    return nn.Sequential(
        nn.ConvTranspose2d(in_channels, out_channels, kernel_size=3, stride=2, output_padding=1, padding=1, bias=True),
        nn.InstanceNorm2d(out_channels),
        nn.LeakyReLU(negative_slope=0.02, inplace=True)
    )

class RecoloringDecoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.dconv_up_4 = de_conv(18 + 512, 256)
        self.dconv_up_3 = de_conv(256 + 256, 128)
        self.dconv_up_2 = de_conv(18 + 128 + 128, 64)
        self.dconv_up_1 = de_conv(18 + 64 + 64, 64)
        self.conv_last = nn.Conv2d(1 + 64, 2, kernel_size=3, padding=1)

    def forward(self, c1, c2, c3, c4, target_palettes_1d, illu):
        bz, h, w = c1.shape[0], c1.shape[2], c1.shape[3]
        tp_reshpaed = target_palettes_1d.reshape(bz, 18, 1, 1)
        tp_c1 = tp_reshpaed.repeat(1, 1, h, w)
        x = torch.cat((c1, tp_c1), 1)
        x = self.dconv_up_4(x)
        x = torch.cat([c2, x], dim=1)
        x = self.dconv_up_3(x)
        bz, h, w = x.shape[0], x.shape[2], x.shape[3]
        tp_c3 = tp_reshpaed.repeat(1, 1, h, w)
        x = torch.cat([tp_c3, c3, x], dim=1)
        x = self.dconv_up_2(x)
        bz, h, w = x.shape[0], x.shape[2], x.shape[3]
        tp_c4 = tp_reshpaed.repeat(1, 1, h, w)
        x = torch.cat([tp_c4, c4, x], dim=1)
        x = self.dconv_up_1(x)
        illu = illu.view(illu.size(0), 1, illu.size(2), illu.size(3))
        x = torch.cat((x, illu), dim=1)
        x = self.conv_last(x)
        x = torch.tanh(x)
        return x

# ===================== 加载模型 =====================

FE = None
RD = None


def load_models():
    global FE, RD
    print("Loading models...")
    FE = FeatureEncoder()
    RD = RecoloringDecoder()
    FE.load_state_dict(torch.load(os.path.join(BASE_DIR, "models", "FE.state_dict.pt"), map_location="cpu", weights_only=True))
    RD.load_state_dict(torch.load(os.path.join(BASE_DIR, "models", "RD.state_dict.pt"), map_location="cpu", weights_only=True))
    FE.eval()
    RD.eval()
    print("Models loaded.")

# ===================== API =====================

IMAGE_EXTS = ('.jpg', '.jpeg', '.png')


def list_images(subdir):
    folder = os.path.join(BASE_DIR, subdir)
    return sorted(f for f in os.listdir(folder) if f.lower().endswith(IMAGE_EXTS))


def serve_image(subdir, name):
    img_path = safe_path(os.path.join(BASE_DIR, subdir), name)
    with open(img_path, "rb") as f:
        return jsonify({"image": base64.b64encode(f.read()).decode()})


def image_to_base64(img):
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


def base64_to_pil_image(value):
    raw = str(value or "")
    if "," in raw and raw.strip().lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    data = base64.b64decode(raw)
    return Image.open(io.BytesIO(data)).convert("RGB")


def rgb_to_lab(rgb):
    rgb_float = np.asarray(rgb, dtype=np.float32) / 255.0
    return cv2.cvtColor(rgb_float, cv2.COLOR_RGB2LAB).astype(np.float32)


def lab_to_rgb(lab):
    lab_float = np.asarray(lab, dtype=np.float32)
    rgb_float = cv2.cvtColor(lab_float, cv2.COLOR_LAB2RGB)
    return np.clip(rgb_float, 0.0, 1.0)


def is_white_background(img_np, threshold=240):
    return np.all(img_np > threshold, axis=2)


def recolor_pil_image(img, palette_rgb, preserve_white_background=True):
    if FE is None or RD is None:
        raise RuntimeError("模型尚未加载")
    orig_w, orig_h = img.size
    h = max(16, 16 * (orig_h // 16))
    w = max(16, 16 * (orig_w // 16))
    img_resized = img.resize((w, h), Image.BILINEAR)
    img_np = np.array(img_resized)

    white_mask = is_white_background(img_np)

    z = (rgb_to_lab(img_np) - [50, 0, 0]) / [50, 127, 127]
    img_tensor = torch.Tensor(z).permute(2, 0, 1).unsqueeze(0)

    pal_np = np.array(palette_rgb).reshape(1, 6, 3) / 255
    pal = torch.Tensor((cv2.cvtColor(pal_np.astype(np.float32), cv2.COLOR_RGB2LAB) - [50, 0, 0]) / [50, 127, 127]).unsqueeze(0)
    pal = pal.view(1, 18)

    illu = img_tensor[:, 0:1, :, :]

    with torch.no_grad():
        c1, c2, c3, c4 = FE(img_tensor)
        out = RD(c1, c2, c3, c4, pal, illu)
        final = torch.cat([(illu + 1) * 50, out * 128], axis=1).permute(0, 2, 3, 1)[0]

    result_rgb = lab_to_rgb(final.numpy())
    result_np = (result_rgb * 255).astype(np.uint8)
    if preserve_white_background:
        result_np[white_mask] = [255, 255, 255]

    result_img = Image.fromarray(result_np)
    return result_img.resize((orig_w, orig_h), Image.BILINEAR)


@app.route("/api/styles", methods=["GET"])
@handle_api_errors
def get_styles():
    return jsonify(list_images("style"))


@app.route("/api/style_image/<path:name>", methods=["GET"])
@handle_api_errors
def style_image(name):
    return serve_image("style", name)


@app.route("/api/kuanshi_image/<style>/<fabric>", methods=["GET"])
@handle_api_errors
def kuanshi_image(style, fabric):
    style_stem = os.path.splitext(os.path.basename(style))[0]
    fabric_stem = os.path.splitext(os.path.basename(fabric))[0]
    return serve_image("kuanshi", f"{fabric_stem}_{style_stem}.png")


@app.route("/api/fabrics", methods=["GET"])
@handle_api_errors
def get_fabrics():
    return jsonify(list_images("fabric"))


@app.route("/api/fabric_image/<path:name>", methods=["GET"])
@handle_api_errors
def fabric_image(name):
    return serve_image("fabric", name)


@app.route("/api/templates", methods=["GET"])
@handle_api_errors
def get_templates():
    return jsonify(list_images("kuanzhuang"))


@app.route("/api/template_image/<path:name>", methods=["GET"])
@handle_api_errors
def template_image(name):
    return serve_image("kuanzhuang", name)


@app.route("/api/landscapes", methods=["GET"])
@handle_api_errors
def get_landscapes():
    return jsonify(list_images("fengjing"))


@app.route("/api/landscape_image/<path:name>", methods=["GET"])
@handle_api_errors
def landscape_image(name):
    return serve_image("fengjing", name)


@app.route("/api/extract_landscape_palette", methods=["POST"])
@handle_api_errors
def api_extract_landscape_palette():
    data = request.json
    landscape_name = data["landscape_name"]
    img_path = safe_path(os.path.join(BASE_DIR, "fengjing"), landscape_name)

    palette = extract_palette_from_image(img_path)
    if palette is None:
        return jsonify({"error": f"无法读取图像 {landscape_name}"}), 400

    return jsonify({"palette": palette.tolist()})


@app.route("/api/recolor", methods=["POST"])
@handle_api_errors
def recolor():
    data = request.json
    style_name = data["style_name"]
    fabric_name = data["fabric_name"]

    if "palette_rgb" not in data:
        return jsonify({"error": "palette_rgb is required"}), 400
    target_palette = np.array(data["palette_rgb"], dtype=np.uint8)
    if target_palette.shape != (6, 3):
        return jsonify({"error": "palette_rgb must be shape (6,3)"}), 400

    style_stem = os.path.splitext(os.path.basename(style_name))[0]
    fabric_stem = os.path.splitext(os.path.basename(fabric_name))[0]
    kuanshi_name = f"{fabric_stem}_{style_stem}.png"

    kuanshi_path = safe_path(os.path.join(BASE_DIR, "kuanshi"), kuanshi_name)
    kuanshi_img = Image.open(kuanshi_path).convert("RGB")
    result_img = recolor_pil_image(kuanshi_img, target_palette, preserve_white_background=True)

    return jsonify({
        "recolor_image": image_to_base64(result_img),
    })


@app.route("/api/recolor_uploaded", methods=["POST"])
@handle_api_errors
def recolor_uploaded():
    data = request.json
    if "image_base64" not in data:
        return jsonify({"error": "image_base64 is required"}), 400
    if "palette_rgb" not in data:
        return jsonify({"error": "palette_rgb is required"}), 400
    target_palette = np.array(data["palette_rgb"], dtype=np.uint8)
    if target_palette.shape != (6, 3):
        return jsonify({"error": "palette_rgb must be shape (6,3)"}), 400
    source_img = base64_to_pil_image(data["image_base64"])
    result_img = recolor_pil_image(
        source_img,
        target_palette,
        preserve_white_background=bool(data.get("preserve_white_background", True))
    )
    return jsonify({
        "recolor_image": image_to_base64(result_img),
    })


# ===================== 调色板提取 =====================

def maxminc_selection(rgb_15colors, sample_num=6):
    rgb_transposed = rgb_15colors.T
    m = rgb_15colors.shape[0]
    selected_indices = []

    var_rgb = np.var(rgb_transposed.astype(np.float32), axis=0)
    ind1 = np.argmax(var_rgb)
    selected_indices.append(ind1)

    coor = np.zeros(m)
    for i in range(m):
        coor[i] = np.linalg.norm(
            rgb_transposed[:, i].astype(np.float32) - rgb_transposed[:, ind1].astype(np.float32)
        )
    coor[selected_indices] = 0
    ind2 = np.argmax(coor)
    selected_indices.append(ind2)

    for j in range(2, sample_num):
        dist = np.zeros((j, m), dtype=np.float32)
        for i in range(m):
            for q in range(j):
                dist[q, i] = np.linalg.norm(
                    rgb_transposed[:, selected_indices[q]].astype(np.float32) - rgb_transposed[:, i].astype(np.float32)
                )
        dist[:, selected_indices] = 0
        min_dist = np.min(dist, axis=0)
        ind_next = np.argmax(min_dist)
        selected_indices.append(ind_next)

    return rgb_15colors[selected_indices]


def cv2_imread_unicode(path):
    """cv2.imread 无法处理 Windows 中文路径，用 imdecode + fromfile 替代"""
    buf = np.fromfile(path, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    return img


def extract_palette_from_rgb_array(rgb):
    if rgb is None:
        return None
    original = rgb
    # 缩小到 200x200 加速 KMeans
    h, w = original.shape[:2]
    scale = min(200 / h, 200 / w)
    if scale < 1:
        original = cv2.resize(original, (int(w * scale), int(h * scale)))
    img = original
    vectorized = img.reshape((-1, 3)).astype(np.float32)

    rng = np.random.RandomState(0)
    k = min(15, len(vectorized))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, _, centers = cv2.kmeans(vectorized, k, None, criteria, 10, cv2.KMEANS_PP_CENTERS,
                               centers=rng.choice(len(vectorized), k, replace=False).astype(np.float32) if False else None)
    center_rgb = np.uint8(centers)

    hsv = cv2.cvtColor(center_rgb.reshape(1, -1, 3), cv2.COLOR_RGB2HSV)
    hues = hsv[0, :, 0]
    sorted_indices = np.argsort(hues)
    sorted_rgb = center_rgb[sorted_indices]

    palette = maxminc_selection(sorted_rgb, sample_num=6)
    return palette


def extract_palette_from_image(img_path):
    """从图片提取6色调色板（KMeans15 + maxminc选6色）"""
    original = cv2_imread_unicode(img_path)
    if original is None:
        return None
    return extract_palette_from_rgb_array(cv2.cvtColor(original, cv2.COLOR_BGR2RGB))


def extract_palette_from_pil_image(img):
    return extract_palette_from_rgb_array(np.array(img.convert("RGB")))


@app.route("/api/extract_palette_upload", methods=["POST"])
@handle_api_errors
def api_extract_palette_upload():
    data = request.json
    if "image_base64" not in data:
        return jsonify({"error": "image_base64 is required"}), 400
    img = base64_to_pil_image(data["image_base64"])
    palette = extract_palette_from_pil_image(img)
    if palette is None:
        return jsonify({"error": "无法读取上传图片"}), 400
    preview = img.copy()
    preview.thumbnail((960, 960), Image.BILINEAR)
    return jsonify({
        "palette": palette.tolist(),
        "image": image_to_base64(preview),
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 51700
    load_models()
    print(f"Service starting on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)
