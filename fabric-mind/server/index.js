import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

loadEnvFile(path.join(root, ".env"));

const { createFabricMindDb } = await import("./db.js");
const fabricMindDb = await createFabricMindDb();
if (fabricMindDb.enabled) {
  console.log("MySQL 持久化已启用");
} else {
  console.log(`MySQL 持久化未启用：${fabricMindDb.reason}`);
}

const port = Number(process.env.PORT || 5177);
const runtimeConfigPath = path.join(__dirname, "runtime-config.json");
const assetStorePath = path.join(__dirname, "runtime-assets.json");
const taskStorePath = path.join(__dirname, "runtime-tasks.json");
const userStorePath = path.join(__dirname, "runtime-users.json");
const tempDir = path.join(root, "public", "tmp");
const adminSessionCookie = "fm_admin_session";
const adminUserName = process.env.FABRICMIND_ADMIN_USER || "User";
const adminPassword = process.env.FABRICMIND_ADMIN_PASSWORD || "change-me-before-deploy";
const adminAuthSecret = process.env.FABRICMIND_ADMIN_SECRET || "fabricmind-admin-dev-secret-change-me";
const adminChallenges = new Map();
const adminLoginAttempts = new Map();

const ALLOWED_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://shop.wtu-wet.cn",
  "https://admin.wtu-wet.cn"
]);

function corsOrigin(req) {
  const origin = req?.headers?.["origin"] || "";
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  // 小程序 wx.request 不带 origin，放行
  if (!origin) return "*";
  return "";
}

const json = (res, body, status = 200, req = null) => {
  const r = req || res._corsReq || null;
  const origin = r ? corsOrigin(r) : "*";
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization"
  };
  if (origin && origin !== "") {
    headers["access-control-allow-origin"] = origin;
  }
  if (origin && origin !== "*") {
    headers["access-control-allow-credentials"] = "true";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

const assets = [
  { id: "a001", name: "黑色短袖", type: "上衣", color: "黑色", style: "通勤", status: "上架", url: "/public/samples/outfits/T_shirt.png" },
  { id: "a002", name: "长袖廓形上衣", type: "上衣", color: "灰黑", style: "秀场", status: "上架", url: "/public/samples/outfits/changxiu.png" },
  { id: "a003", name: "短袖基础款", type: "上衣", color: "浅色", style: "休闲", status: "上架", url: "/public/samples/outfits/duanxiu.png" },
  { id: "a004", name: "灰色短裤", type: "下装", color: "灰色", style: "运动", status: "上架", url: "/public/samples/outfits/shorts.png" },
  { id: "a004b", name: "灰色宽松长裤", type: "下装", color: "灰色", style: "通勤", status: "上架", url: "/public/uploads/black-top-gray-pants.png" },
  { id: "a005", name: "织物样片 01", type: "面料", color: "蓝灰", style: "面料", status: "上架", url: "/public/samples/fabrics/fabric1.jpg" },
  { id: "a006", name: "织物样片 02", type: "面料", color: "暖色", style: "面料", status: "上架", url: "/public/samples/fabrics/fabric2.jpg" }
];
assets.unshift(...loadStoredAssets());

const users = loadStoredUsers();

const shopProductsStorePath = path.join(__dirname, "runtime-shop-products.json");
const shopOrdersStorePath = path.join(__dirname, "runtime-shop-orders.json");
const shopReviewsStorePath = path.join(__dirname, "runtime-shop-reviews.json");

function loadShopProductsStore() {
  if (!fs.existsSync(shopProductsStorePath)) return { styles: [], fabrics: [] };
  try {
    return JSON.parse(fs.readFileSync(shopProductsStorePath, "utf8"));
  } catch (e) {
    console.error("加载商品配置失败，使用空数据:", e.message);
    return { styles: [], fabrics: [] };
  }
}

function saveShopProductsStore() {
  try {
    fs.writeFileSync(shopProductsStorePath, JSON.stringify(shopProducts, null, 2), "utf8");
    if (fabricMindDb.enabled) fabricMindDb.saveShopProducts(shopProducts);
  } catch (e) {
    console.error("保存商品配置失败:", e.message);
  }
}

function loadShopOrdersStore() {
  if (!fs.existsSync(shopOrdersStorePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(shopOrdersStorePath, "utf8"));
  } catch (e) {
    console.error("加载订单数据失败，使用空数据:", e.message);
    return [];
  }
}

function saveShopOrdersStore() {
  try {
    fs.writeFileSync(shopOrdersStorePath, JSON.stringify(shopOrders, null, 2), "utf8");
    if (fabricMindDb.enabled) fabricMindDb.saveShopOrders(shopOrders);
  } catch (e) {
    console.error("保存订单数据失败:", e.message);
  }
}

function loadShopReviewsStore() {
  if (!fs.existsSync(shopReviewsStorePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(shopReviewsStorePath, "utf8"));
  } catch (e) {
    console.error("加载评价数据失败，使用空数据:", e.message);
    return [];
  }
}

function saveShopReviewsStore() {
  try {
    fs.writeFileSync(shopReviewsStorePath, JSON.stringify(shopReviews, null, 2), "utf8");
    if (fabricMindDb.enabled) fabricMindDb.saveShopReviews(shopReviews);
  } catch (e) {
    console.error("保存评价数据失败:", e.message);
  }
}

const shopProducts = loadShopProductsStore();
const shopOrders = loadShopOrdersStore();
const shopReviews = loadShopReviewsStore();

const sessionStorePath = path.join(__dirname, "runtime-user-sessions.json");

function loadUserSessions() {
  if (!fs.existsSync(sessionStorePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(sessionStorePath, "utf8"));
  } catch (e) {
    console.error("加载会话数据失败:", e.message);
    return [];
  }
}

function saveUserSessions() {
  try {
    fs.writeFileSync(sessionStorePath, JSON.stringify(userSessions, null, 2), "utf8");
    if (fabricMindDb.enabled) fabricMindDb.saveUserSessions(userSessions);
  } catch (e) {
    console.error("保存会话数据失败:", e.message);
  }
}

let userSessions = loadUserSessions();

function createUserSession(userId, source) {
  const token = `token-${crypto.randomUUID()}`;
  const session = {
    token,
    userId,
    source,
    createdAt: Date.now(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  };
  userSessions.push(session);
  saveUserSessions();
  return token;
}

function verifyUserSession(token) {
  const now = Date.now();
  let expiredFound = false;
  userSessions = userSessions.filter(s => {
    const expired = s.expiresAt <= now;
    if (expired) expiredFound = true;
    return !expired;
  });
  if (expiredFound) saveUserSessions();

  const session = userSessions.find(s => s.token === token);
  return session || null;
}

function currentUserFromRequest(req) {
  const auth = req.headers["authorization"] || "";
  let token = "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    token = auth.slice(7).trim();
  }
  if (!token) {
    const cookies = parseCookies(req);
    token = cookies["fm_user_session"] || "";
  }
  if (!token) return null;
  const session = verifyUserSession(token);
  if (!session) return null;
  return users.find(u => u.id === session.userId) || null;
}

const miniAppId = process.env.WECHAT_MINI_APPID || "";
const miniSecret = process.env.WECHAT_MINI_SECRET || "";
const webAppId = process.env.WECHAT_WEB_APPID || "";
const webSecret = process.env.WECHAT_WEB_SECRET || "";
const webRedirectUri = process.env.WECHAT_WEB_REDIRECT_URI || "https://api.wtu-wet.cn/api/auth/wechat/web-callback";
const sessionSecret = process.env.FABRICMIND_USER_SESSION_SECRET || "fabricmind-user-session-dev-secret-change-me";



const tasks = [
  {
    id: "t-demo-001",
    user: "演示用户",
    mode: "整套换装",
    status: "success",
    progress: 100,
    points: 8,
    personUrl: "",
    garmentUrl: "",
    resultUrl: "",
    prompt: "保持脸部和背景不变，让服装自然贴合身体",
    createdAt: "2026-05-14 20:30"
  }
];

const videoTasks = [
  {
    id: "v-demo-001",
    user: "演示用户",
    sourceTaskId: "t-demo-001",
    status: "success",
    progress: 100,
    title: "结果图展示视频",
    style: "runway-pan",
    posterUrl: "",
    videoUrl: "",
    previewType: "animated-image",
    createdAt: "2026-05-14 20:40",
    finishedAt: "2026-05-14 20:40"
  }
];

function loadTaskStoreIntoMemory() {
  if (!fs.existsSync(taskStorePath)) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(taskStorePath, "utf8"));
    if (Array.isArray(parsed.tasks)) tasks.splice(0, tasks.length, ...parsed.tasks);
    if (Array.isArray(parsed.videoTasks)) videoTasks.splice(0, videoTasks.length, ...parsed.videoTasks);
  } catch (error) {
    console.warn(`任务记录读取失败，将使用内置演示记录：${error.message}`);
  }
}

function saveTaskStore() {
  try {
    const payload = {
      updatedAt: new Date().toISOString(),
      tasks: tasks.filter((item) => !item.transient).slice(0, 500),
      videoTasks: videoTasks.filter((item) => !item.transient).slice(0, 500)
    };
    const tmpPath = `${taskStorePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmpPath, taskStorePath);
    if (fabricMindDb.enabled) fabricMindDb.saveTasks(tasks, videoTasks);
  } catch (error) {
    console.warn(`任务记录保存失败：${error.message}`);
  }
}

loadTaskStoreIntoMemory();

const defaultRuntimeConfig = {
  activeProvider: "dashscope",
  storage: {
    active: "local",
    local: {
      baseUrl: "http://127.0.0.1:5177",
      note: "当前开发版图片和视频任务结果保存在本地 public 目录"
    },
    oss: {
      enabled: false,
      bucket: "",
      region: "",
      endpoint: "",
      publicBaseUrl: "",
      accessKeyId: "",
      accessKeySecret: "",
      note: "正式上线建议启用 OSS，用于原图、素材图、结果图和视频文件"
    }
  },
  video: {
    activeProvider: "doubao",
    region: "cn-beijing",
    model: "doubao-seedance-1-0-pro-fast-251015",
    resolution: "720P",
    duration: 5,
    promptExtend: true,
    watermark: false,
    maxWaitSeconds: 600,
    mockDurationSeconds: 6,
    note: "默认使用火山引擎 / 豆包图生视频；首帧图先上传 OSS，再调用视频模型。"
  },
  providers: {
    mock: {
      enabled: true
    },
    dashscope: {
      enabled: true,
      apiKey: "",
      region: "beijing",
      model: "wan2.5-i2i-preview",
      size: "720*1280",
      promptExtend: true,
      maxWaitSeconds: 180
    },
    dashscopeTryOn: {
      enabled: false,
      apiKey: "",
      region: "beijing",
      model: "aitryon-plus",
      maxWaitSeconds: 180,
      note: "需要公网图片 URL，正式接 OSS 后启用"
    },
    openai: {
      enabled: false,
      apiKey: "",
      model: "gpt-image-1",
      baseUrl: "https://api.openai.com/v1",
      maxWaitSeconds: 180,
      note: "预留：后续可接 OpenAI Images"
    },
    doubao: {
      enabled: true,
      apiKey: "",
      region: "cn-beijing",
      endpoint: "/images/generations",
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      model: "doubao-seedream-4-5-251128",
      size: "1440x2560",
      videoEndpoint: "/contents/generations/tasks",
      videoModel: "doubao-seedance-1-0-pro-fast-251015",
      threeDModel: "doubao-seed3d-1-0-250928",
      videoResolution: "720p",
      videoDuration: 5,
      maxWaitSeconds: 600,
      note: "火山引擎 / 豆包图像与视频能力"
    }
  }
};

let runtimeConfig = loadRuntimeConfig();

async function hydrateRuntimeFromMysql() {
  if (!fabricMindDb.enabled) return;
  const data = await fabricMindDb.loadAll();
  if (data.runtimeConfig) runtimeConfig = mergeConfig(defaultRuntimeConfig, data.runtimeConfig);
  if (data.assets?.length) assets.splice(0, assets.length, ...data.assets);
  if (data.users?.length) users.splice(0, users.length, ...data.users);
  if (data.userSessions?.length) userSessions = data.userSessions;
  if (data.shopProducts) {
    shopProducts.styles = data.shopProducts.styles || [];
    shopProducts.fabrics = data.shopProducts.fabrics || [];
  }
  if (data.shopOrders?.length) shopOrders.splice(0, shopOrders.length, ...data.shopOrders);
  if (data.shopReviews?.length) shopReviews.splice(0, shopReviews.length, ...data.shopReviews);
  if (data.tasks?.length) tasks.splice(0, tasks.length, ...data.tasks);
  if (data.videoTasks?.length) videoTasks.splice(0, videoTasks.length, ...data.videoTasks);
  console.log("MySQL 数据已加载到 FabricMind 运行缓存");
}

await hydrateRuntimeFromMysql();

const dashscopeCreateEndpoints = {
  beijing: "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/",
  singapore: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/"
};

const dashscopeVideoEndpoints = {
  beijing: "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
  singapore: "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
};

const dashscopeTaskEndpoints = {
  beijing: "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
  singapore: "https://dashscope-intl.aliyuncs.com/api/v1/tasks/{task_id}"
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const idx = part.indexOf("=");
    const key = idx >= 0 ? part.slice(0, idx).trim() : part.trim();
    const value = idx >= 0 ? part.slice(idx + 1).trim() : "";
    return [key, decodeURIComponent(value)];
  }));
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signAdminToken(payload) {
  const body = base64Url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", adminAuthSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyAdminToken(token = "") {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", adminAuthSecret).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (payload.user !== adminUserName) return null;
    return payload;
  } catch {
    return null;
  }
}

function adminFromRequest(req) {
  return verifyAdminToken(parseCookies(req)[adminSessionCookie]);
}

function constantEqual(a = "", b = "") {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

function createAdminChallenge() {
  for (const [key, item] of adminChallenges.entries()) {
    if (Date.now() > item.expiresAt) adminChallenges.delete(key);
  }
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = Array.from({ length: 5 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join("");
  const id = crypto.randomUUID();
  const width = 168;
  const height = 58;
  const colors = ["#111827", "#243b53", "#5b2c6f", "#0f766e", "#7c2d12"];
  const noise = Array.from({ length: 36 }, () => {
    const x = crypto.randomInt(0, width);
    const y = crypto.randomInt(0, height);
    const r = crypto.randomInt(1, 3);
    const opacity = (crypto.randomInt(16, 42) / 100).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#111827" opacity="${opacity}"/>`;
  }).join("");
  const lines = Array.from({ length: 6 }, () => {
    const y1 = crypto.randomInt(4, height - 4);
    const y2 = crypto.randomInt(4, height - 4);
    const c1 = crypto.randomInt(24, 62);
    const c2 = crypto.randomInt(94, 136);
    const color = colors[crypto.randomInt(0, colors.length)];
    return `<path d="M${crypto.randomInt(-10, 16)} ${y1} C ${c1} ${crypto.randomInt(0, height)} ${c2} ${crypto.randomInt(0, height)} ${width + crypto.randomInt(-16, 12)} ${y2}" fill="none" stroke="${color}" stroke-width="${crypto.randomInt(1, 3)}" opacity="0.34"/>`;
  }).join("");
  const chars = code.split("").map((char, index) => {
    const x = 20 + index * 28 + crypto.randomInt(-4, 5);
    const y = crypto.randomInt(35, 48);
    const rotate = crypto.randomInt(-28, 29);
    const size = crypto.randomInt(25, 34);
    const color = colors[crypto.randomInt(0, colors.length)];
    return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" fill="${color}" font-size="${size}" font-family="Georgia, Times New Roman, serif" font-weight="900">${char}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f8fafc"/><stop offset="1" stop-color="#e7e5df"/></linearGradient>
      <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="${crypto.randomInt(1, 9999)}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>
    </defs>
    <rect width="100%" height="100%" rx="12" fill="url(#bg)"/>
    ${noise}${lines}<g filter="url(#rough)">${chars}</g>
  </svg>`;
  adminChallenges.set(id, { answer: code.toLowerCase(), expiresAt: Date.now() + 3 * 60 * 1000 });
  const payload = {
    id,
    type: "image",
    question: "输入图中 5 位验证码",
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  };
  if (process.env.FABRICMIND_DEBUG_CAPTCHA === "1") payload.debugAnswer = code;
  return payload;
}

function verifyAdminChallenge(id, answer) {
  const item = adminChallenges.get(id);
  adminChallenges.delete(id);
  if (!item || Date.now() > item.expiresAt) return false;
  return constantEqual(String(answer || "").trim().toLowerCase(), item.answer);
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}

function loginAttemptState(ip) {
  const state = adminLoginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  if (state.lockedUntil && Date.now() > state.lockedUntil) {
    adminLoginAttempts.delete(ip);
    return { count: 0, lockedUntil: 0 };
  }
  return state;
}

function isLoginLocked(ip) {
  return loginAttemptState(ip).lockedUntil > Date.now();
}

function recordFailedLogin(ip) {
  const state = loginAttemptState(ip);
  state.count += 1;
  if (state.count >= 6) state.lockedUntil = Date.now() + 5 * 60 * 1000;
  adminLoginAttempts.set(ip, state);
}

function clearLoginAttempts(ip) {
  adminLoginAttempts.delete(ip);
}

function secureCookieFlag(req) {
  const host = String(req?.headers?.host || "");
  return host.includes("127.0.0.1") || host.includes("localhost") ? "" : " Secure;";
}

function sharedCookieDomain(req) {
  const host = String(req?.headers?.host || "").split(":")[0].toLowerCase();
  return host.endsWith("wtu-wet.cn") ? " Domain=.wtu-wet.cn;" : "";
}

function setUserCookie(res, token, req) {
  res.setHeader("Set-Cookie", `fm_user_session=${encodeURIComponent(token)}; HttpOnly;${secureCookieFlag(req)} SameSite=Lax; Path=/;${sharedCookieDomain(req)} Max-Age=604800`);
}

function clearUserCookie(res, req) {
  res.setHeader("Set-Cookie", `fm_user_session=; HttpOnly;${secureCookieFlag(req)} SameSite=Lax; Path=/;${sharedCookieDomain(req)} Max-Age=0`);
}

function setAdminCookie(res, token, req) {
  res.setHeader("Set-Cookie", `${adminSessionCookie}=${encodeURIComponent(token)}; HttpOnly;${secureCookieFlag(req)} SameSite=Lax; Path=/; Max-Age=${8 * 60 * 60}`);
}

function clearAdminCookie(res, req) {
  res.setHeader("Set-Cookie", `${adminSessionCookie}=; HttpOnly;${secureCookieFlag(req)} SameSite=Lax; Path=/; Max-Age=0`);
}

function parseMultipartFile(req, buffer) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new Error("缺少 multipart boundary");

  const raw = buffer.toString("binary");
  const parts = raw.split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes('name="file"')) continue;
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const header = part.slice(0, headerEnd);
    let body = part.slice(headerEnd + 4);
    body = body.replace(/\r\n--$/, "").replace(/\r\n$/, "");
    const filename = header.match(/filename="([^"]*)"/)?.[1] || `upload-${Date.now()}.jpg`;
    const partContentType = header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
    return {
      filename,
      contentType: partContentType,
      buffer: Buffer.from(body, "binary")
    };
  }

  throw new Error("没有找到上传文件字段 file");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    storage: {
      ...base.storage,
      ...(override.storage || {}),
      local: { ...base.storage.local, ...((override.storage || {}).local || {}) },
      oss: { ...base.storage.oss, ...((override.storage || {}).oss || {}) }
    },
    video: { ...base.video, ...(override.video || {}) },
    providers: {
      ...base.providers,
      ...(override.providers || {}),
      dashscope: { ...base.providers.dashscope, ...((override.providers || {}).dashscope || {}) },
      dashscopeTryOn: { ...base.providers.dashscopeTryOn, ...((override.providers || {}).dashscopeTryOn || {}) },
      openai: { ...base.providers.openai, ...((override.providers || {}).openai || {}) },
      doubao: { ...base.providers.doubao, ...((override.providers || {}).doubao || {}) }
    }
  };
}

function loadRuntimeConfig() {
  if (!fs.existsSync(runtimeConfigPath)) return structuredClone(defaultRuntimeConfig);
  try {
    const parsed = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8"));
    return mergeConfig(defaultRuntimeConfig, parsed);
  } catch {
    return structuredClone(defaultRuntimeConfig);
  }
}

function saveRuntimeConfig() {
  fs.writeFileSync(runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2), "utf8");
  if (fabricMindDb.enabled) fabricMindDb.saveRuntimeConfig(runtimeConfig);
}

function loadStoredAssets() {
  if (!fs.existsSync(assetStorePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(assetStorePath, "utf8"));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

function defaultUsers() {
  return [
    { id: "u001", name: "演示用户", nickName: "演示用户", points: 128, total: 24, success: 21, avatar: "", avatarUrl: "" },
    { id: "u002", name: "设计师用户", nickName: "设计师用户", points: 92, total: 12, success: 10, avatar: "", avatarUrl: "" }
  ];
}

function loadStoredUsers() {
  const defaults = defaultUsers();
  if (!fs.existsSync(userStorePath)) return defaults;
  try {
    const parsed = JSON.parse(fs.readFileSync(userStorePath, "utf8"));
    if (!Array.isArray(parsed.items)) return defaults;
    const byId = new Map(defaults.map((item) => [item.id, item]));
    for (const item of parsed.items) {
      if (!item?.id) continue;
      byId.set(item.id, {
        ...(byId.get(item.id) || {}),
        ...item,
        name: item.name || item.nickName || "微信用户",
        nickName: item.nickName || item.name || "微信用户",
        avatar: item.avatarUrl || item.avatar || ""
      });
    }
    return Array.from(byId.values());
  } catch {
    return defaults;
  }
}

function saveUsers() {
  fs.writeFileSync(userStorePath, JSON.stringify({ updatedAt: new Date().toISOString(), items: users }, null, 2), "utf8");
  if (fabricMindDb.enabled) fabricMindDb.saveUsers(users);
}

function currentUser() {
  return users[0] || defaultUsers()[0];
}

function markUserTaskCreated(userId, transient = false) {
  if (transient) return;
  const user = users.find((item) => item.id === userId) || currentUser();
  user.total = Number(user.total || 0) + 1;
  saveUsers();
}

function markUserTaskSuccess(task) {
  if (task.transient || task.successCounted) return;
  const user = users.find((item) => item.id === task.userId) || currentUser();
  user.success = Number(user.success || 0) + 1;
  task.successCounted = true;
  saveUsers();
}

function saveStoredAssets() {
  const customAssets = assets.filter((item) => String(item.id).startsWith("a-"));
  fs.writeFileSync(assetStorePath, JSON.stringify({ items: customAssets }, null, 2), "utf8");
  if (fabricMindDb.enabled) fabricMindDb.saveAssets(assets);
}

function publicUser(item) {
  const localBase = runtimeConfig.storage?.local?.baseUrl || `http://127.0.0.1:${port}`;
  const avatarUrl = item.avatarUrl || item.avatar || "";
  const fullAvatarUrl = avatarUrl ? (avatarUrl.startsWith("http") ? avatarUrl : `${localBase}${avatarUrl}`) : "";
  return {
    ...item,
    name: item.nickName || item.name,
    avatar: avatarUrl,
    avatarUrl,
    fullAvatarUrl
  };
}

function publicAsset(item) {
  const localBase = runtimeConfig.storage?.local?.baseUrl || `http://127.0.0.1:${port}`;
  const rawUrl = item.url || "";
  const primaryUrl = item.ossUrl || rawUrl;
  return {
    ...item,
    url: primaryUrl,
    localUrl: item.localUrl || (rawUrl && rawUrl !== primaryUrl ? rawUrl : ""),
    apiUrl: primaryUrl,
    displayUrl: primaryUrl.startsWith("http") ? primaryUrl : `${localBase}${primaryUrl}`,
    fullUrl: primaryUrl.startsWith("http") ? primaryUrl : `${localBase}${primaryUrl}`
  };
}

async function ensureAssetOss(asset) {
  if (!asset || !canUseOss()) return asset;
  if (asset.ossUrl && asset.ossUrl.startsWith("http")) return asset;
  const sourceUrl = asset.url || asset.localUrl || "";
  if (!sourceUrl || sourceUrl.startsWith("http")) return asset;
  try {
    const ossUrl = await uploadLocalPublicFileToOss(sourceUrl, "fabricmind/assets");
    asset.localUrl = asset.localUrl || sourceUrl;
    asset.ossUrl = ossUrl;
    asset.url = ossUrl;
  } catch (error) {
    asset.ossError = error.message;
  }
  return asset;
}

function normalizeMode(mode = "", explicitScope = "") {
  if (["top", "bottom", "full"].includes(explicitScope)) return explicitScope;
  const value = String(mode);
  if (value.includes("下") || value.toLowerCase().includes("bottom")) return "bottom";
  if (value.includes("整") || value.includes("套") || value.includes("全") || value.toLowerCase().includes("full")) return "full";
  return "top";
}

function modePrompt(mode = "", userPrompt = "", explicitScope = "") {
  const scope = normalizeMode(mode, explicitScope);
  const promptMap = {
    top: "【上衣试穿】图1是人物照片，图2是服装素材。只将图2中的上衣穿到图1人物身上，只替换上半身服装区域；保留图1的裤子/裙子、鞋子、脸部、发型、体型、姿势、背景、光照和构图。不要把图2的白底、商品排版、文字、边框、水印带入结果。输出完整人物照片，不要裁掉头、脚或手臂。",
    bottom: "【下装试穿】图1是人物照片，图2是服装素材。只将图2中的裤子或裙子穿到图1人物身上，只替换下半身服装区域；保留图1的上衣、鞋子、脸部、发型、体型、姿势、背景、光照和构图。不要把图2的白底、商品排版、文字、边框、水印带入结果。输出完整人物照片，不要裁掉头、脚或手臂。",
    full: "【整套换装】图1是人物照片，图2是完整服装/套装素材。请识别图2中的上衣和下装，并同时穿到图1人物身上，上半身和下半身都必须完整替换成图2的服装。需要覆盖并移除图1原有服装的颜色、材质和版型；如果图1原本是长袍、裙装或特殊造型，也要改成图2的上衣+裤装/下装形态，不要保留原来的橙色、灰色拼接、盔甲或裙摆结构。保留图1人物的脸部、发型、体型、姿势、背景、光照、构图和全身画面比例。不要把图2的白底、商品排版、文字、边框、水印带入结果。输出完整全身照片，不要裁掉头、脚或手臂。"
  };
  const extra = String(userPrompt || "").trim();
  if (extra.includes("图1") && extra.includes("图2")) return extra;
  return extra ? `${promptMap[scope]}\n${extra}` : promptMap[scope];
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return `${key.slice(0, 2)}***${key.slice(-2)}`;
  return `${key.slice(0, 6)}***${key.slice(-4)}`;
}

function publicModelConfig() {
  const dashscopeKey = runtimeConfig.providers.dashscope.apiKey || process.env.DASHSCOPE_API_KEY || "";
  return {
    activeProvider: runtimeConfig.activeProvider,
    providers: {
      dashscope: {
        ...runtimeConfig.providers.dashscope,
        apiKey: undefined,
        hasKey: Boolean(dashscopeKey),
        keyPreview: maskKey(dashscopeKey)
      },
      doubao: {
        ...runtimeConfig.providers.doubao,
        apiKey: undefined,
        hasKey: Boolean(runtimeConfig.providers.doubao.apiKey),
        keyPreview: maskKey(runtimeConfig.providers.doubao.apiKey || "")
      }
    }
  };
}

function publicStorageConfig() {
  const oss = runtimeConfig.storage.oss || {};
  return {
    active: runtimeConfig.storage.active,
    local: runtimeConfig.storage.local,
    oss: {
      ...oss,
      accessKeyId: undefined,
      accessKeySecret: undefined,
      hasAccessKeyId: Boolean(oss.accessKeyId || process.env.ALIYUN_OSS_ACCESS_KEY_ID),
      hasAccessKeySecret: Boolean(oss.accessKeySecret || process.env.ALIYUN_OSS_ACCESS_KEY_SECRET),
      accessKeyIdPreview: maskKey(oss.accessKeyId || process.env.ALIYUN_OSS_ACCESS_KEY_ID || "")
    }
  };
}

function publicVideoConfig() {
  return runtimeConfig.video;
}

function updateRuntimeConfig(payload) {
  if (payload.activeProvider) runtimeConfig.activeProvider = payload.activeProvider;
  if (payload.storage) {
    runtimeConfig.storage = {
      ...runtimeConfig.storage,
      ...payload.storage,
      local: { ...runtimeConfig.storage.local, ...(payload.storage.local || {}) },
      oss: { ...runtimeConfig.storage.oss, ...(payload.storage.oss || {}) }
    };
    if (payload.storage.oss && !payload.storage.oss.accessKeyId) {
      runtimeConfig.storage.oss.accessKeyId = runtimeConfig.storage.oss.accessKeyId || "";
    }
    if (payload.storage.oss && !payload.storage.oss.accessKeySecret) {
      runtimeConfig.storage.oss.accessKeySecret = runtimeConfig.storage.oss.accessKeySecret || "";
    }
    if (payload.storage.oss?.clearKeys) {
      runtimeConfig.storage.oss.accessKeyId = "";
      runtimeConfig.storage.oss.accessKeySecret = "";
      delete runtimeConfig.storage.oss.clearKeys;
    }
  }
  if (payload.video) runtimeConfig.video = { ...runtimeConfig.video, ...payload.video };
  const providerPatch = payload.providers || {};
  for (const [name, patch] of Object.entries(providerPatch)) {
    if (!runtimeConfig.providers[name]) continue;
    const next = { ...runtimeConfig.providers[name], ...patch };
    if (!patch.apiKey) next.apiKey = runtimeConfig.providers[name].apiKey || "";
    if (patch.clearKey) next.apiKey = "";
    delete next.clearKey;
    runtimeConfig.providers[name] = next;
  }
  saveRuntimeConfig();
  return publicModelConfig();
}

function updateStorageConfig(payload) {
  updateRuntimeConfig({ storage: payload });
  return publicStorageConfig();
}

function updateVideoConfig(payload) {
  updateRuntimeConfig({ video: payload });
  return publicVideoConfig();
}

function imageModelSnapshot(provider) {
  if (provider === "dashscope") return runtimeConfig.providers.dashscope.model || "wan2.5-i2i-preview";
  if (provider === "doubao" || provider === "volcengine") return runtimeConfig.providers.doubao.model || "doubao-seedream-4-5-251128";
  if (provider === "dashscopeTryOn") return runtimeConfig.providers.dashscopeTryOn.model || "aitryon-plus";
  return "mock-local";
}

function videoModelSnapshot(provider) {
  if (provider === "dashscope") return runtimeConfig.video.model || "wan2.7-i2v-2026-04-25";
  if (provider === "doubao" || provider === "volcengine") return runtimeConfig.providers.doubao.videoModel || "doubao-seedance-1-0-pro-fast-251015";
  return "mock-local";
}

function publicUrlToFilePath(urlPath) {
  if (!urlPath || urlPath.startsWith("http") || urlPath.startsWith("data:")) return null;
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const filePath = path.join(root, clean);
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function prepareDashScopeDataUri(buffer, filename = "image.jpg", maxBytes = 9.5 * 1024 * 1024) {
  if (!contentTypeFromName(filename).startsWith("image/")) {
    return { buffer, contentType: contentTypeFromName(filename) };
  }

  fs.mkdirSync(tempDir, { recursive: true });
  const safeBase = `${Date.now()}-${filename.replace(/[^\w.-]/g, "_")}`;
  const inputPath = path.join(tempDir, `wan-in-${safeBase}`);
  const outputPath = path.join(tempDir, `wan-out-${safeBase.replace(/\.[^.]+$/, "")}.jpg`);
  fs.writeFileSync(inputPath, buffer);

  const script = [
    "from PIL import Image",
    "import sys, os, base64",
    "src, dst, max_bytes = sys.argv[1], sys.argv[2], int(float(sys.argv[3]))",
    "img = Image.open(src).convert('RGB')",
    "w, h = img.size",
    "scale = 1.0",
    "if w < 384 or h < 384: scale = max(scale, 384 / w, 384 / h)",
    "if w > 5000 or h > 5000: scale = min(scale, 5000 / w, 5000 / h)",
    "if scale != 1.0: img = img.resize((max(384, int(w * scale)), max(384, int(h * scale))))",
    "for quality in (94, 90, 86, 82, 78, 74, 70, 64, 58):",
    "    img.save(dst, 'JPEG', quality=quality, optimize=True)",
    "    if os.path.getsize(dst) <= max_bytes: break",
    "if os.path.getsize(dst) > max_bytes:",
    "    while os.path.getsize(dst) > max_bytes and min(img.size) > 640:",
    "        img = img.resize((int(img.size[0] * 0.9), int(img.size[1] * 0.9)))",
    "        img.save(dst, 'JPEG', quality=70, optimize=True)"
  ].join("\n");

  try {
    execFileSync("python", ["-c", script, inputPath, outputPath, String(maxBytes)], { stdio: "ignore" });
    return { buffer: fs.readFileSync(outputPath), contentType: "image/jpeg" };
  } catch {
    return { buffer, contentType: contentTypeFromName(filename) };
  } finally {
    fs.rmSync(inputPath, { force: true });
    fs.rmSync(outputPath, { force: true });
  }
}

async function imageToDataUri(urlPath) {
  if (urlPath?.startsWith("data:")) return urlPath;
  if (urlPath?.startsWith("http")) {
    const response = await fetch(urlPath);
    if (!response.ok) throw new Error(`远程图片下载失败：${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    const filename = new URL(urlPath).pathname.split("/").pop() || "image.jpg";
    const prepared = prepareDashScopeDataUri(data, filename);
    return `data:${prepared.contentType};base64,${prepared.buffer.toString("base64")}`;
  }
  const filePath = publicUrlToFilePath(urlPath);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`本地图片不存在：${urlPath}`);
  }
  const prepared = prepareDashScopeDataUri(fs.readFileSync(filePath), path.basename(filePath));
  return `data:${prepared.contentType};base64,${prepared.buffer.toString("base64")}`;
}

function normalizeEndpoint(endpoint = "") {
  return endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function getOssConfig() {
  const oss = runtimeConfig.storage?.oss || {};
  const endpoint = normalizeEndpoint(oss.endpoint || process.env.ALIYUN_OSS_ENDPOINT || "");
  const bucket = oss.bucket || oss.bucketName || process.env.ALIYUN_OSS_BUCKET || "";
  const accessKeyId = oss.accessKeyId || process.env.ALIYUN_OSS_ACCESS_KEY_ID || "";
  const accessKeySecret = oss.accessKeySecret || process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || "";
  const publicBaseUrl = (oss.publicBaseUrl || (bucket && endpoint ? `https://${bucket}.${endpoint}` : "")).replace(/\/+$/, "");
  return {
    enabled: Boolean(oss.enabled || runtimeConfig.storage?.active === "oss"),
    endpoint,
    bucket,
    accessKeyId,
    accessKeySecret,
    publicBaseUrl
  };
}

function canUseOss() {
  const cfg = getOssConfig();
  return Boolean(cfg.enabled && cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.accessKeySecret);
}

async function uploadBufferToOss(buffer, objectKey, contentType) {
  const cfg = getOssConfig();
  if (!canUseOss()) throw new Error("OSS 未完整配置");

  const date = new Date().toUTCString();
  const resource = `/${cfg.bucket}/${objectKey}`;
  const stringToSign = ["PUT", "", contentType, date, resource].join("\n");
  const signature = crypto.createHmac("sha1", cfg.accessKeySecret).update(stringToSign).digest("base64");
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  const url = `https://${cfg.bucket}.${cfg.endpoint}/${encodedKey}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `OSS ${cfg.accessKeyId}:${signature}`,
      Date: date,
      "Content-Type": contentType,
      "Content-Length": String(buffer.length)
    },
    body: buffer
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OSS 上传失败：${response.status}${detail ? ` ${detail.slice(0, 160)}` : ""}`);
  }

  return `${cfg.publicBaseUrl}/${encodedKey}`;
}

function compressImageBuffer(buffer, filename = "upload.jpg", maxBytes = 4.6 * 1024 * 1024) {
  if (!contentTypeFromName(filename).startsWith("image/") || buffer.length <= maxBytes) {
    return { buffer, filename, contentType: contentTypeFromName(filename) };
  }

  fs.mkdirSync(tempDir, { recursive: true });
  const safeBase = `${Date.now()}-${filename.replace(/[^\w.-]/g, "_")}`;
  const inputPath = path.join(tempDir, `in-${safeBase}`);
  const outputPath = path.join(tempDir, `out-${safeBase.replace(/\.[^.]+$/, "")}.jpg`);
  fs.writeFileSync(inputPath, buffer);

  const script = [
    "from PIL import Image",
    "import sys, os",
    "src, dst, max_bytes = sys.argv[1], sys.argv[2], int(float(sys.argv[3]))",
    "img = Image.open(src)",
    "if img.mode not in ('RGB', 'L'): img = img.convert('RGB')",
    "img.thumbnail((1800, 2400))",
    "quality = 92",
    "while quality >= 58:",
    "    img.save(dst, 'JPEG', quality=quality, optimize=True)",
    "    if os.path.getsize(dst) <= max_bytes: break",
    "    quality -= 8",
    "if os.path.getsize(dst) > max_bytes:",
    "    scale = 0.85",
    "    while os.path.getsize(dst) > max_bytes and min(img.size) > 640:",
    "        img = img.resize((int(img.size[0]*scale), int(img.size[1]*scale)))",
    "        img.save(dst, 'JPEG', quality=70, optimize=True)"
  ].join("\n");

  try {
    execFileSync("python", ["-c", script, inputPath, outputPath, String(maxBytes)], { stdio: "ignore" });
    const out = fs.readFileSync(outputPath);
    return { buffer: out, filename: safeBase.replace(/\.[^.]+$/, ".jpg"), contentType: "image/jpeg" };
  } catch {
    return { buffer, filename, contentType: contentTypeFromName(filename) };
  } finally {
    fs.rmSync(inputPath, { force: true });
    fs.rmSync(outputPath, { force: true });
  }
}

function contentTypeFromName(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  return mime[ext] || "image/jpeg";
}

async function uploadLocalPublicFileToOss(urlPath, prefix = "fabricmind/uploads") {
  const filePath = publicUrlToFilePath(urlPath);
  if (!filePath || !fs.existsSync(filePath)) throw new Error(`本地文件不存在：${urlPath}`);
  const ext = path.extname(filePath).toLowerCase() || ".jpg";
  const safeName = path.basename(filePath).replace(/[^\w.-]/g, "_");
  const prepared = compressImageBuffer(fs.readFileSync(filePath), safeName);
  const objectKey = `${prefix}/${Date.now()}-${prepared.filename.replace(/[^\w.-]/g, "_")}`;
  return uploadBufferToOss(prepared.buffer, objectKey, prepared.contentType || mime[ext] || "application/octet-stream");
}

async function imageUrlToBuffer(urlPath) {
  if (urlPath?.startsWith("http")) {
    const response = await fetch(urlPath);
    if (!response.ok) throw new Error(`服装图下载失败：${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const filePath = publicUrlToFilePath(urlPath);
  if (!filePath || !fs.existsSync(filePath)) throw new Error(`本地服装图不存在：${urlPath}`);
  return fs.readFileSync(filePath);
}

function splitGarmentBuffer(buffer, filename = "garment.jpg") {
  fs.mkdirSync(tempDir, { recursive: true });
  const safeBase = `${Date.now()}-${filename.replace(/[^\w.-]/g, "_")}`;
  const inputPath = path.join(tempDir, `split-in-${safeBase}`);
  const topPath = path.join(tempDir, `split-top-${safeBase.replace(/\.[^.]+$/, "")}.jpg`);
  const bottomPath = path.join(tempDir, `split-bottom-${safeBase.replace(/\.[^.]+$/, "")}.jpg`);
  fs.writeFileSync(inputPath, buffer);

  const script = [
    "from PIL import Image",
    "import sys",
    "src, top, bottom = sys.argv[1], sys.argv[2], sys.argv[3]",
    "img = Image.open(src)",
    "if img.mode not in ('RGB', 'L'): img = img.convert('RGB')",
    "w, h = img.size",
    "top_box = (0, 0, w, int(h * 0.48))",
    "bottom_box = (0, int(h * 0.38), w, h)",
    "img.crop(top_box).save(top, 'JPEG', quality=90, optimize=True)",
    "img.crop(bottom_box).save(bottom, 'JPEG', quality=90, optimize=True)"
  ].join("\n");

  try {
    execFileSync("python", ["-c", script, inputPath, topPath, bottomPath], { stdio: "ignore" });
    return {
      top: fs.readFileSync(topPath),
      bottom: fs.readFileSync(bottomPath)
    };
  } finally {
    fs.rmSync(inputPath, { force: true });
    fs.rmSync(topPath, { force: true });
    fs.rmSync(bottomPath, { force: true });
  }
}

async function splitFullGarmentToOss(garmentUrl, taskId) {
  if (!canUseOss()) return null;
  const sourceBuffer = await imageUrlToBuffer(garmentUrl);
  const parts = splitGarmentBuffer(sourceBuffer, `${taskId}-garment.jpg`);
  const topPrepared = compressImageBuffer(parts.top, `${taskId}-top.jpg`);
  const bottomPrepared = compressImageBuffer(parts.bottom, `${taskId}-bottom.jpg`);
  const topUrl = await uploadBufferToOss(topPrepared.buffer, `fabricmind/garment-parts/${taskId}-top.jpg`, "image/jpeg");
  const bottomUrl = await uploadBufferToOss(bottomPrepared.buffer, `fabricmind/garment-parts/${taskId}-bottom.jpg`, "image/jpeg");
  return { topUrl, bottomUrl };
}

async function downloadResultImage(url, taskId) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载结果图失败：${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = path.join(root, "public", "generated");
  fs.mkdirSync(dir, { recursive: true });
  const contentType = response.headers.get("content-type") || "";
  const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
  const fileName = `${taskId}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  if (canUseOss()) {
    try {
      return await uploadBufferToOss(buffer, `fabricmind/generated/${fileName}`, mime[ext] || "image/jpeg");
    } catch (error) {
      console.warn(error.message);
    }
  }
  return `/public/generated/${fileName}`;
}

function extractDashScopeError(payload) {
  const output = payload?.output || {};
  return output.message || payload.message || output.code || payload.code || JSON.stringify(payload);
}

function findVideoUrl(payload) {
  const output = payload?.output || {};
  return (
    output.video_url
    || output.url
    || output.result_url
    || output.video
    || payload?.video_url
    || payload?.url
    || payload?.result_url
    || payload?.content?.video_url
    || payload?.content?.url
    || payload?.data?.video_url
    || payload?.data?.url
    || (Array.isArray(payload?.data) ? payload.data.find((item) => item.url || item.video_url)?.url : "")
    || (Array.isArray(payload?.data) ? payload.data.find((item) => item.url || item.video_url)?.video_url : "")
    || (Array.isArray(output.results) ? output.results.find((item) => item.url || item.video_url)?.url : "")
    || (Array.isArray(output.results) ? output.results.find((item) => item.url || item.video_url)?.video_url : "")
    || ""
  );
}

function extractProviderError(payload) {
  return payload?.error?.message || payload?.message || payload?.error_msg || payload?.code || JSON.stringify(payload);
}

function joinUrl(baseUrl = "", endpoint = "") {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const pathName = String(endpoint || "").replace(/^\/+/, "");
  return `${base}/${pathName}`;
}

function findImageUrl(payload) {
  const output = payload?.output || {};
  return (
    payload?.url
    || payload?.image_url
    || payload?.result_url
    || payload?.data?.url
    || payload?.data?.image_url
    || (Array.isArray(payload?.data) ? payload.data.find((item) => item.url || item.image_url)?.url : "")
    || (Array.isArray(payload?.data) ? payload.data.find((item) => item.url || item.image_url)?.image_url : "")
    || output.url
    || output.image_url
    || output.result_url
    || (Array.isArray(output.results) ? output.results.find((item) => item.url || item.image_url)?.url : "")
    || (Array.isArray(output.results) ? output.results.find((item) => item.url || item.image_url)?.image_url : "")
    || ""
  );
}

function normalizeDoubaoImageSize(size = "") {
  return String(size).toLowerCase() === "2560x1440" ? "2560x1440" : "1440x2560";
}

async function ensurePublicImageUrl(urlPath, prefix = "fabricmind/ark-inputs") {
  if (!urlPath) return urlPath;
  if (urlPath.startsWith("http")) return urlPath;
  if (canUseOss()) return uploadLocalPublicFileToOss(urlPath, prefix);
  const localBase = runtimeConfig.storage?.local?.baseUrl || `http://127.0.0.1:${port}`;
  if (/^https?:\/\//.test(localBase)) return `${localBase.replace(/\/+$/, "")}${urlPath}`;
  throw new Error("火山引擎需要公网图片 URL。请开启 OSS 后再调用火山模型。");
}

async function downloadResultVideo(url, videoTaskId) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载结果视频失败：${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = path.join(root, "public", "videos");
  fs.mkdirSync(dir, { recursive: true });
  const contentType = response.headers.get("content-type") || "";
  const ext = contentType.includes("webm") ? ".webm" : ".mp4";
  const fileName = `${videoTaskId}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  if (canUseOss()) {
    try {
      return await uploadBufferToOss(buffer, `fabricmind/videos/${fileName}`, mime[ext] || "video/mp4");
    } catch (error) {
      console.warn(error.message);
    }
  }
  return `/public/videos/${fileName}`;
}

async function resolvePublicFirstFrameUrl(videoTask, payload) {
  if (payload.publicImageUrl?.startsWith("http")) return payload.publicImageUrl;
  if (payload.imageUrl?.startsWith("http")) return payload.imageUrl;
  const sourceTask = videoTask.sourceTaskId ? tasks.find((item) => item.id === videoTask.sourceTaskId) : null;
  if (sourceTask?.providerResultUrl?.startsWith("http")) return sourceTask.providerResultUrl;
  if (sourceTask?.resultUrl?.startsWith("http")) return sourceTask.resultUrl;
  if (videoTask.posterUrl?.startsWith("http")) return videoTask.posterUrl;
  if (canUseOss()) {
    const localUrl = payload.imageUrl || sourceTask?.resultUrl || videoTask.posterUrl;
    if (localUrl) {
      const publicUrl = await uploadLocalPublicFileToOss(localUrl, "fabricmind/first-frames");
      videoTask.firstFrameOssUrl = publicUrl;
      return publicUrl;
    }
  }
  throw new Error("阿里图生视频需要公网可访问的首帧图片 URL。当前是本地图片，请先上传 OSS 后再生成视频。");
}

async function callDashScopeVideo(videoTask, payload) {
  const cfg = runtimeConfig.video || {};
  const key = runtimeConfig.providers.dashscope.apiKey || process.env.DASHSCOPE_API_KEY || "";
  if (!key) throw new Error("DashScope API Key 未配置，请先在管理端模型配置里保存 key。");

  const firstFrameUrl = await resolvePublicFirstFrameUrl(videoTask, payload);
  videoTask.firstFramePublicUrl = firstFrameUrl;

  const requestPayload = {
    model: cfg.model || "wan2.7-i2v-2026-04-25",
    input: {
      prompt: videoTask.prompt,
      media: [
        {
          type: "first_frame",
          url: firstFrameUrl
        }
      ]
    },
    parameters: {
      resolution: cfg.resolution || "720P",
      duration: Number(cfg.duration || 5),
      prompt_extend: cfg.promptExtend !== false,
      watermark: Boolean(cfg.watermark)
    }
  };

  const region = cfg.region || "beijing";
  const createResponse = await fetch(dashscopeVideoEndpoints[region], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable"
    },
    body: JSON.stringify(requestPayload)
  });
  const createPayload = await createResponse.json();
  if (!createResponse.ok || createPayload.code) {
    throw new Error(`DashScope 视频任务创建失败：${extractDashScopeError(createPayload)}`);
  }

  const dashTaskId = createPayload?.output?.task_id;
  if (!dashTaskId) throw new Error(`DashScope 视频接口未返回 task_id：${JSON.stringify(createPayload)}`);
  videoTask.providerTaskId = dashTaskId;
  videoTask.progress = 20;
  saveTaskStore();

  const maxWaitSeconds = Number(cfg.maxWaitSeconds || 600);
  const deadline = Date.now() + maxWaitSeconds * 1000;
  const pollUrl = dashscopeTaskEndpoints[region].replace("{task_id}", dashTaskId);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const pollResponse = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const resultPayload = await pollResponse.json();
    if (!pollResponse.ok) throw new Error(`DashScope 视频任务查询失败：${extractDashScopeError(resultPayload)}`);
    const output = resultPayload.output || {};
    const status = output.task_status;

    if (status === "SUCCEEDED") {
      const videoUrl = findVideoUrl(resultPayload);
      if (!videoUrl) throw new Error(`DashScope 视频任务成功但未返回视频 URL：${JSON.stringify(resultPayload)}`);
      videoTask.providerVideoUrl = videoUrl;
      try {
        return await downloadResultVideo(videoUrl, videoTask.id);
      } catch {
        return videoUrl;
      }
    }

    if (["FAILED", "CANCELED", "UNKNOWN"].includes(status)) {
      throw new Error(`DashScope 视频任务${status}：${extractDashScopeError(resultPayload)}`);
    }

    videoTask.progress = Math.min(92, videoTask.progress + 10);
    saveTaskStore();
  }

  throw new Error(`DashScope 视频任务超时，超过 ${maxWaitSeconds} 秒。`);
}

async function callDoubaoVideo(videoTask, payload) {
  const cfg = runtimeConfig.providers.doubao || {};
  const key = cfg.apiKey || process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY || "";
  if (!key) throw new Error("火山引擎 Ark API Key 未配置，请先在管理端模型配置里保存 key。");

  const firstFrameUrl = await resolvePublicFirstFrameUrl(videoTask, payload);
  videoTask.firstFramePublicUrl = firstFrameUrl;

  const baseUrl = cfg.baseUrl || "https://ark.cn-beijing.volces.com/api/v3";
  const endpoint = cfg.videoEndpoint || "/contents/generations/tasks";
  const videoPrompt = `${videoTask.prompt || ""} --rs 720p --dur 5 --cf false`.trim();
  const requestPayload = {
    model: cfg.videoModel || runtimeConfig.video.model || "doubao-seedance-1-0-pro-fast-251015",
    content: [
      { type: "text", text: videoPrompt },
      { type: "image_url", image_url: { url: firstFrameUrl }, role: "first_frame" }
    ],
    resolution: "720p",
    duration: 5,
    watermark: false
  };

  const createResponse = await fetch(joinUrl(baseUrl, endpoint), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestPayload)
  });
  const createPayload = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || createPayload.error || createPayload.code) {
    throw new Error(`火山视频任务创建失败：${extractProviderError(createPayload)}`);
  }

  const providerTaskId = createPayload.id || createPayload.task_id || createPayload?.data?.id || createPayload?.output?.task_id;
  const directUrl = findVideoUrl(createPayload);
  if (directUrl) {
    videoTask.providerVideoUrl = directUrl;
    try {
      return await downloadResultVideo(directUrl, videoTask.id);
    } catch {
      return directUrl;
    }
  }
  if (!providerTaskId) throw new Error(`火山视频接口未返回任务 ID：${JSON.stringify(createPayload)}`);

  videoTask.providerTaskId = providerTaskId;
  videoTask.providerTaskPayload = { model: requestPayload.model, resolution: requestPayload.resolution, duration: requestPayload.duration };
  videoTask.progress = 20;
  saveTaskStore();

  const maxWaitSeconds = Number(cfg.maxWaitSeconds || runtimeConfig.video.maxWaitSeconds || 600);
  const deadline = Date.now() + maxWaitSeconds * 1000;
  const pollUrl = joinUrl(baseUrl, `${endpoint.replace(/\/+$/, "")}/${providerTaskId}`);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const pollResponse = await fetch(pollUrl, { headers: { Authorization: `Bearer ${key}` } });
    const resultPayload = await pollResponse.json().catch(() => ({}));
    if (!pollResponse.ok || resultPayload.error) throw new Error(`火山视频任务查询失败：${extractProviderError(resultPayload)}`);

    const status = String(resultPayload.status || resultPayload.task_status || resultPayload?.output?.task_status || resultPayload?.data?.status || "").toLowerCase();
    if (["succeeded", "success", "done", "completed"].includes(status)) {
      const videoUrl = findVideoUrl(resultPayload);
      if (!videoUrl) throw new Error(`火山视频任务成功但未返回视频 URL：${JSON.stringify(resultPayload)}`);
      videoTask.providerVideoUrl = videoUrl;
      try {
        return await downloadResultVideo(videoUrl, videoTask.id);
      } catch {
        return videoUrl;
      }
    }
    if (["failed", "cancelled", "canceled", "error"].includes(status)) {
      throw new Error(`火山视频任务${status}：${extractProviderError(resultPayload)}`);
    }
    videoTask.progress = Math.min(92, videoTask.progress + 10);
    saveTaskStore();
  }

  throw new Error(`火山视频任务超时，超过 ${maxWaitSeconds} 秒。`);
}

async function callDashScopeWan(task, payload) {
  const cfg = runtimeConfig.providers.dashscope;
  const key = cfg.apiKey || process.env.DASHSCOPE_API_KEY || "";
  if (!key) throw new Error("DashScope API Key 未配置，请先在管理端模型配置里保存 key。");

  const images = [await imageToDataUri(task.personUrl)];
  if (task.garmentUrl) images.push(await imageToDataUri(task.garmentUrl));

  const parameters = {
    n: 1,
    watermark: false,
    prompt_extend: Boolean(cfg.promptExtend)
  };
  if (cfg.size && cfg.size !== "auto") parameters.size = cfg.size;

  const requestPayload = {
    model: cfg.model || "wan2.5-i2i-preview",
    input: {
      prompt: task.prompt,
      images
    },
    parameters
  };

  task.wanInput = {
    model: requestPayload.model,
    imageCount: images.length,
    size: parameters.size || "auto",
    promptExtend: parameters.prompt_extend,
    prompt: task.prompt
  };

  const negativePrompt = payload.negativePrompt || "低清晰度、模糊、变形、脸部变化、发型变化、姿势变化、身体结构错误、手指错误、文字、水印、logo、商品白底、边框、排版元素";
  if (negativePrompt.trim()) requestPayload.input.negative_prompt = negativePrompt.trim();

  const region = cfg.region || "beijing";
  const createResponse = await fetch(dashscopeCreateEndpoints[region], {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable"
    },
    body: JSON.stringify(requestPayload)
  });
  const createPayload = await createResponse.json();
  if (!createResponse.ok || createPayload.code) {
    throw new Error(`DashScope 创建任务失败：${extractDashScopeError(createPayload)}`);
  }

  const dashTaskId = createPayload?.output?.task_id;
  if (!dashTaskId) throw new Error(`DashScope 未返回 task_id：${JSON.stringify(createPayload)}`);

  task.providerTaskId = dashTaskId;
  task.progress = 25;
  saveTaskStore();

  const maxWaitSeconds = Number(cfg.maxWaitSeconds || 180);
  const deadline = Date.now() + maxWaitSeconds * 1000;
  const pollUrl = dashscopeTaskEndpoints[region].replace("{task_id}", dashTaskId);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollResponse = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const resultPayload = await pollResponse.json();
    if (!pollResponse.ok) throw new Error(`DashScope 查询任务失败：${extractDashScopeError(resultPayload)}`);
    const output = resultPayload.output || {};
    const status = output.task_status;

    if (status === "SUCCEEDED") {
      const result = (output.results || []).find((item) => item.url);
      if (!result?.url) throw new Error(`DashScope 成功但未返回图片 URL：${JSON.stringify(resultPayload)}`);
      task.providerResultUrl = result.url;
      task.actualPrompt = result.actual_prompt || result.orig_prompt || "";
      try {
        return await downloadResultImage(result.url, task.id);
      } catch {
        return result.url;
      }
    }

    if (["FAILED", "CANCELED", "UNKNOWN"].includes(status)) {
      throw new Error(`DashScope 任务${status}：${extractDashScopeError(resultPayload)}`);
    }

    task.progress = Math.min(92, task.progress + 12);
    saveTaskStore();
  }

  throw new Error(`DashScope 任务超时，超过 ${maxWaitSeconds} 秒。`);
}

async function callDoubaoImage(task, payload) {
  const cfg = runtimeConfig.providers.doubao || {};
  const key = cfg.apiKey || process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY || "";
  if (!key) throw new Error("火山引擎 Ark API Key 未配置，请先在管理端模型配置里保存 key。");

  const personImageUrl = await ensurePublicImageUrl(task.personUrl, "fabricmind/ark-inputs");
  const garmentImageUrl = task.garmentUrl ? await ensurePublicImageUrl(task.garmentUrl, "fabricmind/ark-inputs") : "";
  task.personUrl = personImageUrl;
  if (garmentImageUrl) task.garmentUrl = garmentImageUrl;

  const images = [personImageUrl];
  if (garmentImageUrl) images.push(garmentImageUrl);

  const requestPayload = {
    model: cfg.model || "doubao-seedream-4-5-251128",
    prompt: task.prompt,
    image: images,
    size: normalizeDoubaoImageSize(cfg.size),
    response_format: "url",
    watermark: false
  };

  task.doubaoInput = {
    model: requestPayload.model,
    imageCount: images.length,
    size: requestPayload.size,
    prompt: task.prompt
  };

  const response = await fetch(joinUrl(cfg.baseUrl || "https://ark.cn-beijing.volces.com/api/v3", cfg.endpoint || "/images/generations"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(requestPayload)
  });
  const resultPayload = await response.json().catch(() => ({}));
  if (!response.ok || resultPayload.error || resultPayload.code) {
    throw new Error(`火山图片生成失败：${extractProviderError(resultPayload)}`);
  }

  const resultUrl = findImageUrl(resultPayload);
  if (!resultUrl) throw new Error(`火山图片接口未返回图片 URL：${JSON.stringify(resultPayload)}`);
  task.providerResultUrl = resultUrl;
  try {
    return await downloadResultImage(resultUrl, task.id);
  } catch {
    return resultUrl;
  }
}

async function callDashScopeTryOn(task, payload) {
  const cfg = runtimeConfig.providers.dashscopeTryOn || runtimeConfig.providers.dashscope;
  const key = cfg.apiKey || process.env.DASHSCOPE_API_KEY || "";
  if (!key) throw new Error("DashScope API Key 未配置，请先保存 key。");

  let personImageUrl = task.personUrl;
  let garmentUrl = task.garmentUrl;

  const ensurePublicUrl = async (url) => {
    if (!url) return url;
    const isLocal = !url.startsWith("http") || url.includes("localhost") || url.includes("127.0.0.1");
    if (isLocal) {
      if (canUseOss()) {
        try {
          const pathOnly = url.startsWith("http") ? new URL(url).pathname : url;
          return await uploadLocalPublicFileToOss(pathOnly);
        } catch (e) {
          throw new Error(`自动上传图片到 OSS 失败: ${e.message}`);
        }
      }
      throw new Error(`专业试衣模型需要公网图片。当前图片地址 (${url}) 为本地路径，阿里服务器无法访问。请先在管理端“设置”中配置并开启阿里云 OSS。`);
    }
    return url;
  };

  try {
    personImageUrl = await ensurePublicUrl(personImageUrl);
    garmentUrl = await ensurePublicUrl(garmentUrl);
  } catch (e) {
    throw e;
  }

  task.personUrl = personImageUrl;
  task.garmentUrl = garmentUrl;

  const inputParams = { person_image_url: personImageUrl };
  const scope = normalizeMode(task.mode, payload.scope || task.scope);
  if (scope === "full") {
    let splitParts = null;
    if (!payload.bottomGarmentUrl) {
      try {
        splitParts = await splitFullGarmentToOss(garmentUrl, task.id);
      } catch (error) {
        task.splitGarmentError = error.message;
      }
    }
    inputParams.top_garment_url = payload.topGarmentUrl ? await ensurePublicUrl(payload.topGarmentUrl) : splitParts?.topUrl || garmentUrl;
    inputParams.bottom_garment_url = payload.bottomGarmentUrl ? await ensurePublicUrl(payload.bottomGarmentUrl) : splitParts?.bottomUrl || garmentUrl;
    if (splitParts) task.splitGarmentParts = splitParts;
  } else if (scope === "bottom") {
    inputParams.bottom_garment_url = garmentUrl;
  } else {
    inputParams.top_garment_url = garmentUrl;
  }
  task.tryOnScope = scope;
  task.tryOnInput = inputParams;

  const requestPayload = {
    model: cfg.model || "aitryon-plus",
    input: inputParams,
    parameters: { resolution: -1, restore_face: true }
  };

  const region = cfg.region || "beijing";
  const tryOnEndpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis/";
  const createResponse = await fetch(tryOnEndpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-DashScope-Async": "enable" },
    body: JSON.stringify(requestPayload)
  });
  const createPayload = await createResponse.json();
  if (!createResponse.ok || createPayload.code) throw new Error(`DashScope 试衣任务失败：${extractDashScopeError(createPayload)}`);

  const dashTaskId = createPayload?.output?.task_id;
  if (!dashTaskId) throw new Error(`DashScope 未返回 task_id：${JSON.stringify(createPayload)}`);

  task.providerTaskId = dashTaskId;
  task.progress = 25;
  saveTaskStore();

  const maxWaitSeconds = Number(cfg.maxWaitSeconds || 180);
  const deadline = Date.now() + maxWaitSeconds * 1000;
  const pollUrl = dashscopeTaskEndpoints[region].replace("{task_id}", dashTaskId);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollResponse = await fetch(pollUrl, { headers: { Authorization: `Bearer ${key}` } });
    const resultPayload = await pollResponse.json();
    if (!pollResponse.ok) throw new Error(`查询任务失败：${extractDashScopeError(resultPayload)}`);
    const output = resultPayload.output || {};
    const status = output.task_status;

    if (status === "SUCCEEDED") {
      const resultUrl = output.image_url || output.result_url || (output.results && output.results[0]?.url) || output.task_metrics?.result?.url || output.task_metrics?.image_url;
      if (!resultUrl) throw new Error(`成功但未返回图片 URL：${JSON.stringify(resultPayload)}`);
      task.providerResultUrl = resultUrl;
      try { return await downloadResultImage(resultUrl, task.id); } catch { return resultUrl; }
    }

    if (["FAILED", "CANCELED", "UNKNOWN"].includes(status)) throw new Error(`试衣任务${status}：${extractDashScopeError(resultPayload)}`);
    task.progress = Math.min(92, task.progress + 12);
    saveTaskStore();
  }
  throw new Error(`试衣任务超时。`);
}

function runMockGeneration(task) {
  setTimeout(() => {
    if (task.status === "failed" || task.status === "success") return;
    task.status = "running";
    task.progress = 55;
    saveTaskStore();
  }, 900);

  setTimeout(() => {
    if (task.status === "failed" || task.status === "success") return;
    if (!task.personUrl) {
      task.status = "failed";
      task.progress = 100;
      task.errorMessage = "缺少人物图，无法生成结果";
      task.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      saveTaskStore();
      return;
    }
    task.status = "success";
    task.progress = 100;
    task.resultUrl = task.personUrl;
    task.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    markUserTaskSuccess(task);
    saveTaskStore();
  }, 2600);
}

async function runGenerationTask(task, payload) {
  const provider = payload.provider || runtimeConfig.activeProvider || "mock";
  task.provider = provider;
  task.modelName = task.modelName || imageModelSnapshot(provider);

  if (provider === "dashscopeTryOn") {
    task.status = "running";
    task.progress = 18;
    saveTaskStore();
    try {
      task.resultUrl = await callDashScopeTryOn(task, payload);
      task.status = "success";
      task.progress = 100;
      task.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      markUserTaskSuccess(task);
      saveTaskStore();
    } catch (error) {
      task.status = payload.fallbackToMock === false ? "failed" : "running";
      task.errorMessage = error.message;
      if (payload.fallbackToMock === false) {
        task.progress = 100;
        task.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
        saveTaskStore();
        return;
      }
      task.provider = "mock";
      task.prompt = `${task.prompt}\n\n真实模型失败，本地 mock 兜底。原因：${error.message}`;
      saveTaskStore();
      runMockGeneration(task);
    }
    return;
  }

  if (provider === "mock") {
    runMockGeneration(task);
    return;
  }

  task.status = "running";
  task.progress = 18;
  saveTaskStore();
  try {
    if (provider === "doubao" || provider === "volcengine") task.resultUrl = await callDoubaoImage(task, payload);
    else if (provider === "dashscope") task.resultUrl = await callDashScopeWan(task, payload);
    else throw new Error(`${provider} 供应商配置已预留，但后端真实调用逻辑还没有接入。`);
    task.status = "success";
    task.progress = 100;
    task.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    markUserTaskSuccess(task);
    saveTaskStore();
  } catch (error) {
    task.status = payload.fallbackToMock === false ? "failed" : "running";
    task.errorMessage = error.message;
    if (payload.fallbackToMock === false) {
      task.progress = 100;
      task.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      saveTaskStore();
      return;
    }
    task.provider = "mock";
    task.prompt = `${task.prompt}\n\n真实模型暂不可用，已使用本地 mock 兜底。原因：${error.message}`;
    saveTaskStore();
    runMockGeneration(task);
  }
}

function createTask(payload, userOption) {
  if (!payload.personUrl || !payload.garmentUrl) {
    throw new Error("缺少人物图或服装图，无法创建生成任务");
  }
  const id = `t-${Date.now()}`;
  const mode = payload.mode || "整套换装";
  const scope = normalizeMode(mode, payload.scope);
  const provider = payload.provider || runtimeConfig.activeProvider || "mock";
  const user = userOption || currentUser();
  const task = {
    id,
    user: payload.userName || user.nickName || user.name || "微信用户",
    userId: payload.userId || user.id,
    userAvatarUrl: user.avatarUrl || user.avatar || "",
    mode,
    scope,
    status: "queued",
    progress: 12,
    points: 8,
    personUrl: payload.personUrl,
    garmentUrl: payload.garmentUrl,
    resultUrl: "",
    prompt: modePrompt(mode, payload.prompt, scope),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    provider,
    modelName: imageModelSnapshot(provider),
    transient: Boolean(payload.transient)
  };
  tasks.unshift(task);
  markUserTaskCreated(task.userId, task.transient);
  saveTaskStore();
  runGenerationTask(task, payload);
  return task;
}

function createVideoTask(payload, userOption) {
  const sourceTask = payload.sourceTaskId ? tasks.find((item) => item.id === payload.sourceTaskId) : null;
  const posterUrl = payload.imageUrl || sourceTask?.resultUrl || "";
  if (!posterUrl) throw new Error("缺少视频首帧图，无法创建视频任务");
  const id = `v-${Date.now()}`;
  const provider = payload.provider || runtimeConfig.video.activeProvider || "mock";
  const user = userOption || currentUser();
  const videoTask = {
    id,
    user: sourceTask?.user || payload.userName || user.nickName || user.name || "微信用户",
    userId: sourceTask?.userId || payload.userId || user.id,
    userAvatarUrl: sourceTask?.userAvatarUrl || user.avatarUrl || user.avatar || "",
    sourceTaskId: payload.sourceTaskId || "",
    status: "queued",
    progress: 8,
    title: payload.title || "结果图展示视频",
    style: payload.style || "runway-pan",
    prompt: payload.prompt || "根据结果图生成适合服装展示的短视频，镜头轻微推进，突出服装材质和整体造型。",
    posterUrl,
    videoUrl: "",
    previewType: "animated-image",
    provider,
    modelName: videoModelSnapshot(provider),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    transient: Boolean(payload.transient)
  };
  videoTasks.unshift(videoTask);
  saveTaskStore();

  runVideoTask(videoTask, payload);

  return videoTask;
}

function runMockVideoTask(videoTask) {
  setTimeout(() => {
    if (videoTask.status === "success" || videoTask.status === "failed") return;
    videoTask.status = "running";
    videoTask.progress = 48;
    saveTaskStore();
  }, 700);

  setTimeout(() => {
    if (videoTask.status === "success" || videoTask.status === "failed") return;
    videoTask.status = "success";
    videoTask.progress = 100;
    videoTask.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    saveTaskStore();
  }, 2200);
}

async function runVideoTask(videoTask, payload) {
  const provider = payload.provider || runtimeConfig.video.activeProvider || "mock";
  videoTask.provider = provider;
  videoTask.modelName = videoTask.modelName || videoModelSnapshot(provider);

  if (provider === "mock") {
    runMockVideoTask(videoTask);
    return;
  }

  videoTask.status = "running";
  videoTask.progress = 12;
  saveTaskStore();
  try {
    if (provider === "doubao" || provider === "volcengine") videoTask.videoUrl = await callDoubaoVideo(videoTask, payload);
    else if (provider === "dashscope") videoTask.videoUrl = await callDashScopeVideo(videoTask, payload);
    else throw new Error(`${provider} 视频供应商配置已预留，但后端真实调用逻辑还没有接入。`);
    videoTask.status = "success";
    videoTask.progress = 100;
    videoTask.previewType = "video";
    videoTask.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    saveTaskStore();
  } catch (error) {
    videoTask.errorMessage = error.message;
    if (payload.fallbackToMock === false) {
      videoTask.status = "failed";
      videoTask.progress = 100;
      videoTask.finishedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      saveTaskStore();
      return;
    }
    videoTask.provider = "mock";
    videoTask.status = "running";
    videoTask.prompt = `${videoTask.prompt}\n\n真实视频模型暂不可用，已使用动态图片预览兜底。原因：${error.message}`;
    saveTaskStore();
    runMockVideoTask(videoTask);
  }
}

function serveFile(req, res, pathname) {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  let filePath = path.join(root, clean);
  if (pathname === "/" || pathname === "/mobile") filePath = path.join(root, "mobile", "index.html");
  if (pathname === "/admin") filePath = path.join(root, "admin", "index.html");
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": mime[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyToShopFrontend(req, res) {
  const shopPort = Number(process.env.FABRICMIND_SHOP_PORT || 3000);
  const upstream = http.request({
    hostname: "127.0.0.1",
    port: shopPort,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${shopPort}`
    }
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });
  upstream.on("error", () => json(res, { message: "电商前台未启动" }, 502));
  req.pipe(upstream);
}

function serveAdminLogin(res) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FabricMind Admin Login</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#111827;background:#f5f3ef;display:grid;place-items:center;overflow:hidden}
    .stage{position:fixed;inset:0;display:grid;grid-template-columns:1.05fr .95fr;opacity:.92}.panel-img{position:relative;overflow:hidden}.panel-img img{width:100%;height:100%;object-fit:cover;filter:saturate(.9) contrast(1.03)}.panel-img:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,23,42,.15),rgba(245,243,239,.92))}
    .grain{position:fixed;inset:0;background:radial-gradient(circle at 20% 10%,rgba(255,255,255,.72),transparent 24%),radial-gradient(circle at 75% 15%,rgba(17,24,39,.08),transparent 25%),linear-gradient(135deg,rgba(255,255,255,.18),rgba(0,0,0,.03));pointer-events:none}
    .login{position:relative;z-index:2;width:min(430px,calc(100vw - 36px));padding:34px;border:1px solid rgba(17,24,39,.10);border-radius:28px;background:rgba(255,255,255,.82);box-shadow:0 30px 80px rgba(17,24,39,.16);backdrop-filter:blur(18px)}
    .brand{font-weight:950;font-size:30px;letter-spacing:0;margin-bottom:6px}.sub{color:#6b7280;font-size:14px;line-height:1.55;margin-bottom:24px}.badge{display:inline-flex;align-items:center;height:30px;padding:0 11px;border-radius:999px;background:#111827;color:#fff;font-size:12px;font-weight:900;margin-bottom:18px}
    label{display:block;margin-top:14px;color:#374151;font-size:13px;font-weight:900}input{width:100%;height:46px;margin-top:8px;padding:0 14px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;color:#111827;font-size:15px;outline:none}input:focus{border-color:#111827;box-shadow:0 0 0 3px rgba(17,24,39,.08)}
    .verify{display:grid;grid-template-columns:1fr 178px;gap:10px;align-items:end}.captcha-box{height:58px;margin-top:8px;border-radius:14px;background:#f3f4f6;display:grid;place-items:center;overflow:hidden;border:1px solid #e5e7eb;cursor:pointer}.captcha-box img{display:block;width:168px;height:58px}.refresh-tip{margin-top:6px;color:#6b7280;font-size:11px;font-weight:800;text-align:center}
    button{width:100%;height:48px;margin-top:22px;border:0;border-radius:15px;background:#111827;color:#fff;font-size:15px;font-weight:950;cursor:pointer;box-shadow:0 14px 26px rgba(17,24,39,.18)}button:active{transform:translateY(1px)}.msg{min-height:20px;margin-top:13px;color:#dc2626;font-size:13px;font-weight:800}.foot{margin-top:18px;color:#6b7280;font-size:12px;line-height:1.5}
    @media(max-width:760px){.stage{grid-template-columns:1fr}.panel-img:first-child{display:none}.login{margin:18px}.brand{font-size:27px}}
  </style>
</head>
<body>
  <div class="stage"><div class="panel-img missing-image">缺少登录预览图</div><div></div></div>
  <div class="grain"></div>
  <form class="login" id="loginForm">
    <div class="badge">ADMIN SECURE GATE</div>
    <div class="brand">FabricMind 控制台</div>
    <div class="sub">登录后才能进入素材、用户、模型和生成任务管理。每次登录都需要一次性安全校验。</div>
    <label>账号<input id="username" autocomplete="username" value="User"></label>
    <label>密码<input id="password" type="password" autocomplete="current-password" placeholder="请输入管理密码"></label>
    <div class="verify">
      <label>安全校验<input id="challengeAnswer" autocomplete="off" maxlength="5" placeholder="输入验证码"></label>
      <div><label>动态图形验证码</label><div class="captcha-box" id="captchaBox" title="点击刷新"><img id="captchaImage" alt="验证码"></div><div class="refresh-tip">看不清？点图片刷新</div></div>
    </div>
    <input id="challengeId" type="hidden">
    <button type="submit">登录管理端</button>
    <div class="msg" id="message"></div>
    <div class="foot">登录态使用 HttpOnly Cookie 保存，后台接口会逐次验证签名和过期时间。</div>
  </form>
  <script>
    async function loadChallenge(){
      const res = await fetch('/api/admin/challenge');
      const data = await res.json();
      challengeId.value = data.id;
      captchaImage.src = data.image;
      challengeAnswer.value = '';
    }
    captchaBox.addEventListener('click', loadChallenge);
    loginForm.addEventListener('submit', async (event)=>{
      event.preventDefault();
      message.textContent = '';
      const res = await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:username.value,password:password.value,challengeId:challengeId.value,challengeAnswer:challengeAnswer.value})});
      const data = await res.json().catch(()=>({}));
      if(!res.ok){ message.textContent = data.message || '登录失败'; await loadChallenge(); return; }
      location.href = '/admin';
    });
    loadChallenge();
  </script>
</body>
</html>`;
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function redirectToAdminLogin(res) {
  res.writeHead(302, { location: "/admin/login" });
  res.end();
}

const server = http.createServer(async (req, res) => {
  res._corsReq = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const host = String(req.headers.host || "").split(":")[0].toLowerCase();

  if (req.method === "OPTIONS") return json(res, {});
  if (host === "shop.wtu-wet.cn" && !pathname.startsWith("/.well-known/") && !pathname.startsWith("/api/") && !pathname.startsWith("/public/") && !pathname.startsWith("/resources/")) {
    return proxyToShopFrontend(req, res);
  }
  if (pathname === "/admin/login") return serveAdminLogin(res);
  if (pathname === "/api/admin/challenge") return json(res, createAdminChallenge());
  if (pathname === "/api/admin/login" && req.method === "POST") {
    const ip = clientIp(req);
    if (isLoginLocked(ip)) return json(res, { message: "登录尝试过多，请 5 分钟后再试" }, 429);
    const body = await readBody(req);
    const okUser = constantEqual(body.username || "", adminUserName);
    const okPassword = constantEqual(body.password || "", adminPassword);
    const okChallenge = verifyAdminChallenge(body.challengeId, body.challengeAnswer);
    if (!okUser || !okPassword || !okChallenge) {
      recordFailedLogin(ip);
      return json(res, { message: "账号、密码或安全校验错误" }, 401);
    }
    clearLoginAttempts(ip);
    const token = signAdminToken({ user: adminUserName, iat: Date.now(), exp: Date.now() + 8 * 60 * 60 * 1000, nonce: crypto.randomUUID() });
    setAdminCookie(res, token, req);
    return json(res, { ok: true, user: adminUserName });
  }
  if (pathname === "/api/admin/logout" && req.method === "POST") {
    clearAdminCookie(res, req);
    return json(res, { ok: true });
  }
  if (pathname === "/api/admin/me") {
    const admin = adminFromRequest(req);
    return admin ? json(res, { ok: true, user: admin.user, expiresAt: admin.exp }) : json(res, { message: "未登录" }, 401);
  }

  // --- 微信统一登录 API ---
  if (!global.webLoginStates) {
    global.webLoginStates = new Map();
  }
  const webLoginStates = global.webLoginStates;

  if (pathname === "/api/auth/wechat/miniprogram-login" && req.method === "POST") {
    const body = await readBody(req);
    const { code, nickName, avatarUrl } = body;
    if (!code) return json(res, { message: "缺少 code 参数" }, 400);

    let openid = "";
    let unionid = "";

    if (!miniAppId || !miniSecret) {
      openid = `mock-mini-openid-${code}`;
      unionid = `mock-unionid-user`; 
    } else {
      try {
        const wxRes = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${miniAppId}&secret=${miniSecret}&js_code=${code}&grant_type=authorization_code`);
        const wxData = await wxRes.json();
        if (wxData.errcode) {
          return json(res, { message: `微信登录失败: ${wxData.errmsg}` }, 400);
        }
        openid = wxData.openid || "";
        unionid = wxData.unionid || "";
      } catch (e) {
        return json(res, { message: `微信接口调用错误: ${e.message}` }, 500);
      }
    }

    let user = null;
    if (unionid) {
      user = users.find(u => u.unionid === unionid);
    }
    if (!user && openid) {
      user = users.find(u => u.miniOpenid === openid);
    }

    if (user) {
      if (openid) user.miniOpenid = openid;
      if (unionid) user.unionid = unionid;
      if (nickName && (!user.nickName || user.nickName === "微信用户")) {
        user.nickName = nickName;
        user.name = nickName;
      }
      if (avatarUrl && !user.avatarUrl) {
        user.avatarUrl = avatarUrl;
        user.avatar = avatarUrl;
      }
      user.lastLoginAt = new Date().toLocaleString("zh-CN", { hour12: false });
      user.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      saveUsers();
    } else {
      user = {
        id: `u_${Date.now()}`,
        unionid: unionid || "",
        miniOpenid: openid || "",
        webOpenid: "",
        nickName: nickName || "微信用户",
        avatarUrl: avatarUrl || "",
        phone: "",
        points: 128,
        total: 0,
        success: 0,
        lastLoginAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        updatedAt: new Date().toLocaleString("zh-CN", { hour12: false })
      };
      user.name = user.nickName;
      user.avatar = user.avatarUrl;
      users.push(user);
      saveUsers();
    }

    const token = createUserSession(user.id, "miniprogram");
    return json(res, { token, user: publicUser(user) });
  }

  // --- 小程序扫码登录（QR Token 流程）---
  if (!global.qrLoginSessions) {
    global.qrLoginSessions = new Map();
  }
  const qrLoginSessions = global.qrLoginSessions;

  // 清理过期的 QR session（5 分钟过期）
  for (const [k, v] of qrLoginSessions.entries()) {
    if (Date.now() - v.createdAt > 5 * 60 * 1000) qrLoginSessions.delete(k);
  }

  // 1. 网页请求生成 QR token
  if (pathname === "/api/auth/qr/create" && req.method === "POST") {
    const qrToken = `qr-${crypto.randomUUID()}`;
    qrLoginSessions.set(qrToken, {
      status: "pending",    // pending | confirmed | expired
      userId: null,
      sessionToken: null,
      createdAt: Date.now()
    });
    return json(res, { qrToken });
  }

  // 2. 网页轮询 QR 状态
  if (pathname === "/api/auth/qr/status" && req.method === "GET") {
    const qrToken = url.searchParams.get("qrToken") || "";
    const session = qrLoginSessions.get(qrToken);
    if (!session) return json(res, { status: "expired" });
    if (session.status === "confirmed" && session.sessionToken) {
      const userSessionToken = session.sessionToken;
      const userId = session.userId;
      qrLoginSessions.delete(qrToken);
      // 设置 Cookie 并返回登录成功
      setUserCookie(res, userSessionToken, req);
      const user = users.find(u => u.id === userId);
      return json(res, { status: "confirmed", user: user ? publicUser(user) : null });
    }
    return json(res, { status: session.status });
  }

  // 3. 小程序扫码后确认登录
  if (pathname === "/api/auth/qr/confirm" && req.method === "POST") {
    const body = await readBody(req);
    const { qrToken, code, nickName, avatarUrl } = body;
    if (!qrToken) return json(res, { message: "缺少 qrToken" }, 400);
    const session = qrLoginSessions.get(qrToken);
    if (!session) return json(res, { message: "QR 码已过期，请刷新重试" }, 400);
    if (session.status !== "pending") return json(res, { message: "QR 码已被使用" }, 400);

    // 用 wx.login code 换取 openid（与 miniprogram-login 相同逻辑）
    let openid = "";
    let unionid = "";

    if (!code) {
      // 如果没有 code，检查小程序本地已有 token（Authorization header）
      const miniUser = currentUserFromRequest(req);
      if (miniUser) {
        openid = miniUser.miniOpenid || "";
        unionid = miniUser.unionid || "";
      } else {
        return json(res, { message: "缺少 code 或有效登录态" }, 400);
      }
    } else if (!miniAppId || !miniSecret) {
      openid = `mock-mini-openid-${code}`;
      unionid = `mock-unionid-user`;
    } else {
      try {
        const wxRes = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${miniAppId}&secret=${miniSecret}&js_code=${code}&grant_type=authorization_code`);
        const wxData = await wxRes.json();
        if (wxData.errcode) return json(res, { message: `微信登录失败: ${wxData.errmsg}` }, 400);
        openid = wxData.openid || "";
        unionid = wxData.unionid || "";
      } catch (e) {
        return json(res, { message: `微信接口调用错误: ${e.message}` }, 500);
      }
    }

    // 查找或创建用户
    let user = null;
    if (unionid) user = users.find(u => u.unionid === unionid);
    if (!user && openid) user = users.find(u => u.miniOpenid === openid);

    if (user) {
      if (openid) user.miniOpenid = openid;
      if (unionid) user.unionid = unionid;
      if (nickName && (!user.nickName || user.nickName === "微信用户")) { user.nickName = nickName; user.name = nickName; }
      if (avatarUrl && !user.avatarUrl) { user.avatarUrl = avatarUrl; user.avatar = avatarUrl; }
      user.lastLoginAt = new Date().toLocaleString("zh-CN", { hour12: false });
      user.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      saveUsers();
    } else {
      user = {
        id: `u_${Date.now()}`,
        unionid: unionid || "",
        miniOpenid: openid || "",
        webOpenid: "",
        nickName: nickName || "微信用户",
        avatarUrl: avatarUrl || "",
        phone: "",
        points: 128,
        total: 0,
        success: 0,
        lastLoginAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        updatedAt: new Date().toLocaleString("zh-CN", { hour12: false })
      };
      user.name = user.nickName;
      user.avatar = user.avatarUrl;
      users.push(user);
      saveUsers();
    }

    // 创建 web session token，写回 QR session
    const userSessionToken = createUserSession(user.id, "qr-web");
    session.status = "confirmed";
    session.userId = user.id;
    session.sessionToken = userSessionToken;

    return json(res, { success: true, user: publicUser(user) });
  }

  if (pathname === "/api/auth/wechat/web-login-url" && req.method === "GET") {
    const redirect = url.searchParams.get("redirect") || "/checkout";
    const state = crypto.randomUUID();
    webLoginStates.set(state, { redirect, createdAt: Date.now() });

    for (const [key, val] of webLoginStates.entries()) {
      if (Date.now() - val.createdAt > 10 * 60 * 1000) webLoginStates.delete(key);
    }

    let authUrl = "";
    if (!webAppId) {
      authUrl = `http://${req.headers.host}/api/auth/wechat/web-callback?code=mock-code-123&state=${state}`;
    } else {
      authUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${webAppId}&redirect_uri=${encodeURIComponent(webRedirectUri)}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
    }
    return json(res, { url: authUrl });
  }

  if (pathname === "/api/auth/wechat/web-callback" && req.method === "GET") {
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const stateData = webLoginStates.get(state);
    if (!stateData) {
      res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
      return res.end("<h3>State 校验失败 / 链接已过期，请重新登录。</h3>");
    }
    webLoginStates.delete(state);

    let openid = "";
    let unionid = "";
    let nickname = "";
    let headimgurl = "";

    if (!webAppId || !webSecret) {
      openid = `mock-web-openid-${Date.now()}`;
      unionid = `mock-unionid-user`; 
      nickname = "测试微信网页用户";
      headimgurl = "";
    } else {
      try {
        const tokenRes = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${webAppId}&secret=${webSecret}&code=${code}&grant_type=authorization_code`);
        const tokenData = await tokenRes.json();
        if (tokenData.errcode) {
          res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
          return res.end(`<h3>微信授权失败: ${tokenData.errmsg}</h3>`);
        }
        const accessToken = tokenData.access_token;
        openid = tokenData.openid;
        unionid = tokenData.unionid || "";

        const userRes = await fetch(`https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}`);
        const userData = await userRes.json();
        nickname = userData.nickname || "";
        headimgurl = userData.headimgurl || "";
        if (userData.unionid) unionid = userData.unionid;
      } catch (e) {
        res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
        return res.end(`<h3>服务器微信接口调用错误: ${e.message}</h3>`);
      }
    }

    let user = null;
    if (unionid) {
      user = users.find(u => u.unionid === unionid);
    }
    if (!user && openid) {
      user = users.find(u => u.webOpenid === openid);
    }

    if (user) {
      if (openid) user.webOpenid = openid;
      if (unionid) user.unionid = unionid;
      if (nickname && (!user.nickName || user.nickName === "微信用户")) {
        user.nickName = nickname;
        user.name = nickname;
      }
      if (headimgurl && !user.avatarUrl) {
        user.avatarUrl = headimgurl;
        user.avatar = headimgurl;
      }
      user.lastLoginAt = new Date().toLocaleString("zh-CN", { hour12: false });
      user.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      saveUsers();
    } else {
      user = {
        id: `u_${Date.now()}`,
        unionid: unionid || "",
        miniOpenid: "",
        webOpenid: openid || "",
        nickName: nickname || "微信网页用户",
        avatarUrl: headimgurl || "",
        phone: "",
        points: 128,
        total: 0,
        success: 0,
        lastLoginAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        updatedAt: new Date().toLocaleString("zh-CN", { hour12: false })
      };
      user.name = user.nickName;
      user.avatar = user.avatarUrl;
      users.push(user);
      saveUsers();
    }

    const token = createUserSession(user.id, "web");
    setUserCookie(res, token, req);

    const frontendBase = process.env.WECHAT_WEB_FRONTEND_URL || (req.headers.host.includes("127.0.0.1") || req.headers.host.includes("localhost") ? "http://127.0.0.1:3000" : "https://shop.wtu-wet.cn");
    res.writeHead(302, { Location: `${frontendBase}${stateData.redirect}` });
    return res.end();
  }

  if (pathname === "/api/me" && req.method === "GET") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    return json(res, { user: publicUser(user) });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    let token = "";
    const auth = req.headers["authorization"] || "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      token = auth.slice(7).trim();
    }
    if (!token) {
      const cookies = parseCookies(req);
      token = cookies["fm_user_session"] || "";
    }
    if (token) {
      const idx = userSessions.findIndex(s => s.token === token);
      if (idx !== -1) {
        userSessions.splice(idx, 1);
        saveUserSessions();
      }
    }
    clearUserCookie(res, req);
    return json(res, { success: true });
  }

  // --- 电商公开/用户 API ---
  if (pathname === "/api/shop/styles" && req.method === "GET") {
    return json(res, shopProducts.styles);
  }
  if (pathname === "/api/shop/fabrics" && req.method === "GET") {
    return json(res, shopProducts.fabrics);
  }
  if (pathname === "/api/shop/preview" && req.method === "GET") {
    const styleId = url.searchParams.get("styleId") || url.searchParams.get("style");
    const fabricId = url.searchParams.get("fabricId") || url.searchParams.get("fabric");
    const style = shopProducts.styles.find(s => s.id === styleId);
    const fabric = shopProducts.fabrics.find(f => f.id === fabricId);
    if (!style || !fabric) {
      return json(res, { message: "未找到对应的款式或面料" }, 400);
    }
    const previewUrl = fabric.previewUrls?.[styleId] || "";
    if (!previewUrl) {
      return json(res, { message: "缺少该款式和面料的预览图，请先在数据库中补充 OSS 地址" }, 404);
    }
    const finalPrice = style.basePrice + fabric.priceMarkup;
    return json(res, {
      styleId,
      fabricId,
      previewUrl,
      price: finalPrice
    });
  }
  if (pathname === "/api/shop/products" && req.method === "GET") {
    return json(res, shopProducts.styles);
  }
  if (pathname.startsWith("/api/shop/products/") && req.method === "GET") {
    const id = pathname.split("/").pop();
    const style = shopProducts.styles.find(s => s.id === id);
    if (!style) return json(res, { message: "未找到对应商品" }, 404);
    return json(res, { product: style, fabrics: shopProducts.fabrics });
  }

  // 订单 (用户)
  if (pathname === "/api/shop/orders" && req.method === "POST") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);

    const body = await readBody(req);
    const { styleId, fabricId, size, quantity, paymentMethod, receiver } = body;
    const style = shopProducts.styles.find(s => s.id === styleId);
    const fabric = shopProducts.fabrics.find(f => f.id === fabricId);
    if (!style || !fabric) {
      return json(res, { message: "未找到对应的款式或面料" }, 400);
    }
    const unitPrice = style.basePrice + fabric.priceMarkup;
    const qty = Math.max(1, Number(quantity) || 1);
    const order = {
      id: `ord-${Date.now()}`,
      userId: user.id,
      styleId,
      fabricId,
      size: size || "M",
      quantity: qty,
      unitPrice,
      amount: unitPrice * qty,
      status: "pending_payment",
      paymentMethod: paymentMethod || "wechat-alipay",
      receiver: receiver || { fullName: "", phone: "", email: "", address: "" },
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      paidAt: null
    };
    shopOrders.unshift(order);
    saveShopOrdersStore();
    return json(res, { success: true, order });
  }
  if (pathname.startsWith("/api/shop/orders/") && pathname.endsWith("/pay/mock") && req.method === "POST") {
    const parts = pathname.split("/");
    const id = parts[parts.length - 3];
    const order = shopOrders.find(o => o.id === id);
    if (!order) return json(res, { message: "订单不存在" }, 404);

    const user = currentUserFromRequest(req);
    if (!user || order.userId !== user.id) {
      return json(res, { message: "无权支付此订单" }, 403);
    }

    order.status = "paid";
    order.paidAt = new Date().toLocaleString("zh-CN", { hour12: false });
    saveShopOrdersStore();
    return json(res, { success: true, order });
  }
  if (pathname.startsWith("/api/shop/orders/") && req.method === "GET") {
    const id = pathname.split("/").pop();
    const order = shopOrders.find(o => o.id === id);
    if (!order) return json(res, { message: "订单不存在" }, 404);

    const user = currentUserFromRequest(req);
    if (!user || order.userId !== user.id) {
      return json(res, { message: "无权访问此订单" }, 403);
    }

    return json(res, order);
  }
  if (pathname === "/api/me/shop/orders" && req.method === "GET") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    const userOrders = shopOrders.filter(o => o.userId === user.id);
    return json(res, { items: userOrders });
  }

  // 评价 (用户)
  if (pathname === "/api/shop/reviews" && req.method === "GET") {
    return json(res, shopReviews);
  }
  if (pathname === "/api/shop/reviews" && req.method === "POST") {
    const body = await readBody(req);
    const { name, role, rating, comment } = body;
    if (!name || !comment || !rating) {
      return json(res, { message: "参数不完整" }, 400);
    }
    const maxId = shopReviews.reduce((max, r) => r.id > max ? r.id : max, 0);
    const review = {
      id: maxId + 1,
      name: String(name).trim(),
      role: String(role || "定制买家").trim(),
      rating: Number(rating) || 5,
      comment: String(comment).trim(),
      date: new Date().toISOString().split("T")[0],
      verified: true
    };
    shopReviews.unshift(review);
    saveShopReviewsStore();
    return json(res, { success: true, review });
  }

  if (pathname.startsWith("/api/admin/") && !adminFromRequest(req)) {
    return json(res, { message: "管理端未登录或登录已过期" }, 401);
  }
  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !adminFromRequest(req)) {
    return redirectToAdminLogin(res);
  }

  // --- 电商管理端 API ---
  if (pathname === "/api/admin/shop/orders" && req.method === "GET") {
    return json(res, { items: shopOrders });
  }
  if (pathname.startsWith("/api/admin/shop/orders/") && req.method === "PATCH") {
    const id = pathname.split("/").pop();
    const body = await readBody(req);
    const order = shopOrders.find(o => o.id === id);
    if (!order) return json(res, { message: "订单不存在" }, 404);
    if (body.status) order.status = body.status;
    if (body.receiver) order.receiver = { ...order.receiver, ...body.receiver };
    saveShopOrdersStore();
    return json(res, { success: true, order });
  }
  if (pathname.startsWith("/api/admin/shop/orders/") && req.method === "DELETE") {
    const id = pathname.split("/").pop();
    const idx = shopOrders.findIndex(o => o.id === id);
    if (idx !== -1) {
      shopOrders.splice(idx, 1);
      saveShopOrdersStore();
    }
    return json(res, { success: true });
  }

  if (pathname === "/api/admin/shop/styles" && req.method === "POST") {
    const body = await readBody(req);
    const { id, name, nameKey, image, basePrice } = body;
    if (!id || !name || !basePrice || !image) {
      return json(res, { message: "参数不完整" }, 400);
    }
    if (shopProducts.styles.some(s => s.id === id)) {
      return json(res, { message: "款式ID已存在" }, 400);
    }
    const style = {
      id,
      name,
      nameKey: nameKey || `style.${id}.name`,
      image,
      basePrice: Number(basePrice)
    };
    shopProducts.styles.push(style);
    saveShopProductsStore();
    return json(res, { success: true, style });
  }
  if (pathname.startsWith("/api/admin/shop/styles/") && req.method === "PATCH") {
    const id = pathname.split("/").pop();
    const body = await readBody(req);
    const style = shopProducts.styles.find(s => s.id === id);
    if (!style) return json(res, { message: "款式不存在" }, 404);
    if (body.name) style.name = body.name;
    if (body.nameKey) style.nameKey = body.nameKey;
    if (body.image) style.image = body.image;
    if (body.basePrice !== undefined) style.basePrice = Number(body.basePrice);
    saveShopProductsStore();
    return json(res, { success: true, style });
  }
  if (pathname.startsWith("/api/admin/shop/styles/") && req.method === "DELETE") {
    const id = pathname.split("/").pop();
    const idx = shopProducts.styles.findIndex(s => s.id === id);
    if (idx !== -1) {
      shopProducts.styles.splice(idx, 1);
      saveShopProductsStore();
    }
    return json(res, { success: true });
  }

  if (pathname === "/api/admin/shop/fabrics" && req.method === "POST") {
    const body = await readBody(req);
    const { id, name, nameKey, composition, weight, width, pantone, hex, rgb, priceMarkup } = body;
    if (!id || !name || priceMarkup === undefined) {
      return json(res, { message: "参数不完整" }, 400);
    }
    if (shopProducts.fabrics.some(f => f.id === id)) {
      return json(res, { message: "面料ID已存在" }, 400);
    }
    const fabric = {
      id,
      name,
      nameKey: nameKey || `fabric.${id}.name`,
      composition: composition || "",
      weight: weight || "",
      width: width || "",
      pantone: pantone || "",
      hex: hex || "#FFFFFF",
      rgb: rgb || "255, 255, 255",
      priceMarkup: Number(priceMarkup)
    };
    shopProducts.fabrics.push(fabric);
    saveShopProductsStore();
    return json(res, { success: true, fabric });
  }
  if (pathname.startsWith("/api/admin/shop/fabrics/") && req.method === "PATCH") {
    const id = pathname.split("/").pop();
    const body = await readBody(req);
    const fabric = shopProducts.fabrics.find(f => f.id === id);
    if (!fabric) return json(res, { message: "面料不存在" }, 404);
    if (body.name) fabric.name = body.name;
    if (body.nameKey) fabric.nameKey = body.nameKey;
    if (body.composition !== undefined) fabric.composition = body.composition;
    if (body.weight !== undefined) fabric.weight = body.weight;
    if (body.width !== undefined) fabric.width = body.width;
    if (body.pantone !== undefined) fabric.pantone = body.pantone;
    if (body.hex !== undefined) fabric.hex = body.hex;
    if (body.rgb !== undefined) fabric.rgb = body.rgb;
    if (body.priceMarkup !== undefined) fabric.priceMarkup = Number(body.priceMarkup);
    saveShopProductsStore();
    return json(res, { success: true, fabric });
  }
  if (pathname.startsWith("/api/admin/shop/fabrics/") && req.method === "DELETE") {
    const id = pathname.split("/").pop();
    const idx = shopProducts.fabrics.findIndex(f => f.id === id);
    if (idx !== -1) {
      shopProducts.fabrics.splice(idx, 1);
      saveShopProductsStore();
    }
    return json(res, { success: true });
  }

  if (pathname === "/api/admin/shop/reviews" && req.method === "GET") {
    return json(res, { items: shopReviews });
  }
  if (pathname.startsWith("/api/admin/shop/reviews/") && req.method === "DELETE") {
    const id = Number(pathname.split("/").pop());
    const idx = shopReviews.findIndex(r => r.id === id);
    if (idx !== -1) {
      shopReviews.splice(idx, 1);
      saveShopReviewsStore();
    }
    return json(res, { success: true });
  }

  if (pathname === "/api/health") {
    return json(res, {
      ok: true,
      service: "FabricMind local API",
      port,
      activeProvider: runtimeConfig.activeProvider,
      dashscopeReady: Boolean(runtimeConfig.providers.dashscope.apiKey || process.env.DASHSCOPE_API_KEY),
      doubaoReady: Boolean(runtimeConfig.providers.doubao.apiKey || process.env.ARK_API_KEY || process.env.VOLCENGINE_ARK_API_KEY)
    });
  }

  if (pathname === "/api/assets") {
    const type = url.searchParams.get("type");
    const sourceItems = type && type !== "全部" ? assets.filter((x) => x.type === type) : assets;
    await Promise.all(sourceItems.map(ensureAssetOss));
    const items = sourceItems.map(publicAsset);
    return json(res, { items });
  }

  if (pathname === "/api/admin/users") return json(res, { items: users.map(publicUser) });
  if (pathname === "/api/me/profile" && req.method === "GET") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    return json(res, { user: publicUser(user) });
  }
  if (pathname === "/api/me/profile" && req.method === "POST") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    const body = await readBody(req);
    const nickName = String(body.nickName || body.name || user.nickName || user.name || "微信用户").trim().slice(0, 32);
    const avatarUrl = String(body.avatarUrl || body.avatar || user.avatarUrl || user.avatar || "").trim();
    user.nickName = nickName || "微信用户";
    user.name = user.nickName;
    user.avatarUrl = avatarUrl;
    user.avatar = avatarUrl;
    if (Number.isFinite(Number(body.points))) user.points = Number(body.points);
    if (body.lastCheckInDate) user.lastCheckInDate = String(body.lastCheckInDate);
    user.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    saveUsers();
    return json(res, { user: publicUser(user) });
  }
  if (pathname === "/api/admin/assets" && req.method === "GET") {
    await Promise.all(assets.map(ensureAssetOss));
    saveStoredAssets();
    return json(res, { items: assets.map(publicAsset) });
  }
  if (pathname === "/api/admin/assets" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.url && !body.ossUrl) return json(res, { message: "缺少素材图片 URL" }, 400);
    const asset = {
      id: `a-${Date.now()}`,
      name: body.name || "新上传素材",
      type: body.type || "上衣",
      color: body.color || "未标注",
      style: body.style || "管理员上传",
      status: body.status || "上架",
      url: body.url || body.ossUrl,
      ossUrl: body.ossUrl || body.url || "",
      createdAt: new Date().toLocaleString("zh-CN", { hour12: false })
    };
    await ensureAssetOss(asset);
    assets.unshift(asset);
    saveStoredAssets();
    return json(res, { asset: publicAsset(asset) });
  }
  if (pathname.startsWith("/api/admin/assets/") && req.method === "DELETE") {
    const id = pathname.split("/").pop();
    const idx = assets.findIndex((a) => a.id === id);
    if (idx !== -1) assets.splice(idx, 1);
    saveStoredAssets();
    return json(res, { success: true });
  }
  if (pathname === "/api/admin/tasks") return json(res, { items: tasks });
  if (pathname.startsWith("/api/admin/tasks/") && req.method === "DELETE") {
    const id = decodeURIComponent(pathname.split("/").pop());
    const idx = tasks.findIndex((task) => task.id === id);
    if (idx !== -1) tasks.splice(idx, 1);
    saveTaskStore();
    return json(res, { success: true });
  }
  if (pathname === "/api/admin/results") return json(res, { items: tasks.filter((x) => x.status === "success") });
  if (pathname === "/api/admin/videos") return json(res, { items: videoTasks });
  if (pathname.startsWith("/api/admin/videos/") && req.method === "DELETE") {
    const id = decodeURIComponent(pathname.split("/").pop());
    const idx = videoTasks.findIndex((video) => video.id === id);
    if (idx !== -1) videoTasks.splice(idx, 1);
    saveTaskStore();
    return json(res, { success: true });
  }
  if (pathname.startsWith("/api/admin/users/") && req.method === "PATCH") {
    const id = decodeURIComponent(pathname.split("/").pop());
    const body = await readBody(req);
    const user = users.find((item) => item.id === id);
    if (!user) return json(res, { message: "user not found" }, 404);
    if (body.nickName || body.name) {
      user.nickName = String(body.nickName || body.name).trim().slice(0, 32) || user.nickName;
      user.name = user.nickName;
    }
    if (body.avatarUrl || body.avatar) {
      user.avatarUrl = String(body.avatarUrl || body.avatar).trim();
      user.avatar = user.avatarUrl;
    }
    if (Number.isFinite(Number(body.points))) user.points = Number(body.points);
    user.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    saveUsers();
    return json(res, { user: publicUser(user) });
  }
  if (pathname === "/api/admin/storage-config" && req.method === "GET") return json(res, publicStorageConfig());
  if (pathname === "/api/admin/storage-config" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, updateStorageConfig(body));
  }
  if (pathname === "/api/admin/video-config" && req.method === "GET") return json(res, publicVideoConfig());
  if (pathname === "/api/admin/video-config" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, updateVideoConfig(body));
  }
  if (pathname === "/api/admin/model-config" && req.method === "GET") return json(res, publicModelConfig());
  if (pathname === "/api/admin/model-config" && req.method === "POST") {
    const body = await readBody(req);
    return json(res, updateRuntimeConfig(body));
  }
  if (pathname === "/api/admin/model-test" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.personUrl || !body.garmentUrl) {
      return json(res, { message: "缺少模型测试人物图或服装图" }, 400);
    }
    const task = createTask({
      provider: body.provider || runtimeConfig.activeProvider,
      mode: body.mode || "模型测试",
      prompt: body.prompt || "将服装图中的衣服自然地换到人物图中的人物身上，保持人物脸部、姿势、体型、背景和光照尽量不变。",
      personUrl: body.personUrl,
      garmentUrl: body.garmentUrl,
      fallbackToMock: body.fallbackToMock !== false,
      transient: Boolean(body.transient)
    });
    return json(res, { taskId: task.id, task });
  }

  if (pathname === "/api/me/history") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    const userTasks = tasks.filter((t) => t.userId === user.id);
    return json(res, { items: userTasks });
  }
  if (pathname === "/api/me/videos") {
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    const userVideos = videoTasks.filter((v) => v.userId === user.id);
    return json(res, { items: userVideos });
  }

  if (pathname.startsWith("/api/tasks/")) {
    const id = pathname.split("/").pop();
    const task = tasks.find((x) => x.id === id);
    if (!task) return json(res, { message: "task not found" }, 404);

    if (adminFromRequest(req)) {
      return json(res, task);
    }

    const user = currentUserFromRequest(req);
    if (!user || task.userId !== user.id) {
      return json(res, { message: "无权访问此任务" }, 403);
    }
    return json(res, task);
  }

  if (pathname.startsWith("/api/videos/")) {
    const id = pathname.split("/").pop();
    const videoTask = videoTasks.find((x) => x.id === id);
    if (!videoTask) return json(res, { message: "video task not found" }, 404);

    if (adminFromRequest(req)) {
      return json(res, videoTask);
    }

    const user = currentUserFromRequest(req);
    if (!user || videoTask.userId !== user.id) {
      return json(res, { message: "无权访问此视频任务" }, 403);
    }
    return json(res, videoTask);
  }

  if (pathname === "/api/videos" && req.method === "POST") {
    const body = await readBody(req);
    const user = currentUserFromRequest(req) || (adminFromRequest(req) ? currentUser() : null);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    try {
      const videoTask = createVideoTask(body, user);
      return json(res, { videoTaskId: videoTask.id, videoTask });
    } catch (error) {
      return json(res, { message: error.message }, 400);
    }
  }

  if (pathname === "/api/uploads/temp" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.base64 && !body.url) {
      return json(res, { message: "缺少上传图片内容" }, 400);
    }
    if (body.url) {
      const localUrl = String(body.url);
      return json(res, {
        id: `temp-upload-${Date.now()}`,
        url: localUrl,
        localUrl,
        displayUrl: localUrl,
        storage: "local-temp"
      });
    }
    try {
      const contentType = body.contentType || "image/jpeg";
      const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
      const rawBuffer = Buffer.from(String(body.base64).replace(/^data:[^;]+;base64,/, ""), "base64");
      const prepared = compressImageBuffer(rawBuffer, body.filename || `upload${ext}`);
      const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${prepared.filename.replace(/[^\w.-]/g, "_") || `upload${ext}`}`;
      const dir = path.join(root, "public", "tmp-uploads");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, safeName), prepared.buffer);
      const localUrl = `/public/tmp-uploads/${safeName}`;
      return json(res, {
        id: `temp-upload-${Date.now()}`,
        url: localUrl,
        localUrl,
        displayUrl: localUrl,
        storage: "local-temp"
      });
    } catch (error) {
      return json(res, { message: error.message }, 500);
    }
  }

  if (pathname === "/api/uploads" && req.method === "POST") {
    if ((req.headers["content-type"] || "").includes("multipart/form-data")) {
      try {
        const file = parseMultipartFile(req, await readRawBody(req));
        const extFromName = path.extname(file.filename).toLowerCase();
        const extFromType = file.contentType.includes("png") ? ".png" : file.contentType.includes("webp") ? ".webp" : ".jpg";
        const ext = extFromName || extFromType;
        const prepared = compressImageBuffer(file.buffer, file.filename || `upload${ext}`);
        const safeName = `${Date.now()}-${prepared.filename.replace(/[^\w.-]/g, "_") || `upload${ext}`}`;

        if (canUseOss()) {
          const ossUrl = await uploadBufferToOss(prepared.buffer, `fabricmind/uploads/${safeName}`, prepared.contentType || file.contentType);
          return json(res, {
            id: `upload-${Date.now()}`,
            url: ossUrl,
            localUrl: "",
            ossUrl,
            ossKey: new URL(ossUrl).pathname.replace(/^\/+/, ""),
            storage: "oss"
          });
        }

        const dir = path.join(root, "public", "uploads");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, safeName), prepared.buffer);
        const localUrl = `/public/uploads/${safeName}`;
        return json(res, {
          id: `upload-${Date.now()}`,
          url: localUrl,
          localUrl,
          ossKey: `mock/uploads/${safeName}`,
          storage: "local"
        });
      } catch (error) {
        return json(res, { message: error.message }, 500);
      }
    }

    const body = await readBody(req);
    if (body.base64) {
      try {
        const contentType = body.contentType || "image/jpeg";
        const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
        const safeName = `${Date.now()}-${(body.filename || `upload${ext}`).replace(/[^\w.-]/g, "_")}`;
        const rawBuffer = Buffer.from(String(body.base64).replace(/^data:[^;]+;base64,/, ""), "base64");
        const prepared = compressImageBuffer(rawBuffer, body.filename || `upload${ext}`);
        const buffer = prepared.buffer;
        const finalContentType = prepared.contentType || contentType;

        if (canUseOss()) {
          const ossUrl = await uploadBufferToOss(buffer, `fabricmind/uploads/${safeName}`, finalContentType);
          return json(res, {
            id: `upload-${Date.now()}`,
            url: ossUrl,
            localUrl: "",
            ossUrl,
            ossKey: new URL(ossUrl).pathname.replace(/^\/+/, ""),
            storage: "oss"
          });
        }

        const dir = path.join(root, "public", "uploads");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, safeName), buffer);
        const localUrl = `/public/uploads/${safeName}`;
        return json(res, {
          id: `upload-${Date.now()}`,
          url: localUrl,
          localUrl,
          ossKey: `mock/uploads/${safeName}`,
          storage: "local"
        });
      } catch (error) {
        return json(res, { message: error.message }, 500);
      }
    }

    if (!body.url) return json(res, { message: "缺少要上传的图片 URL" }, 400);
    const sourceUrl = body.url;
    if (canUseOss() && !sourceUrl.startsWith("http")) {
      try {
        const ossUrl = await uploadLocalPublicFileToOss(sourceUrl, "fabricmind/uploads");
        return json(res, {
          id: `upload-${Date.now()}`,
          url: ossUrl,
          ossUrl,
          ossKey: new URL(ossUrl).pathname.replace(/^\/+/, ""),
          storage: "oss"
        });
      } catch (error) {
        return json(res, { message: error.message }, 500);
      }
    }
    return json(res, {
      id: `upload-${Date.now()}`,
      url: sourceUrl,
      ossKey: `mock/uploads/${Date.now()}.png`,
      storage: "local"
    });
  }

  if (pathname === "/api/generation/try-on" && req.method === "POST") {
    const body = await readBody(req);
    const user = currentUserFromRequest(req);
    if (!user) return json(res, { message: "请先微信登录" }, 401);
    try {
      const task = createTask(body, user);
      return json(res, { taskId: task.id, task });
    } catch (error) {
      return json(res, { message: error.message }, 400);
    }
  }

  return serveFile(req, res, pathname);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`FabricMind local server: http://127.0.0.1:${port}`);
  console.log(`LAN API for miniprogram: http://0.0.0.0:${port}`);
  console.log(`Mobile preview:          http://127.0.0.1:${port}/mobile`);
  console.log(`Admin console:           http://127.0.0.1:${port}/admin`);
});
