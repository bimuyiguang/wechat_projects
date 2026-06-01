# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PaletteFusionNet** is a Tauri v2 desktop app that recolors garment+fabric images using color palettes extracted from landscape photos. Users select a garment style and a fabric to see a pre-generated garment+fabric combination, then apply a landscape-derived palette via AI recoloring. A PyTorch neural network (FeatureEncoder + RecoloringDecoder) performs the recoloring inference in Lab color space.

## Development Commands

```bash
# Install Tauri CLI
npm install

# Dev mode — compiles Rust, spawns Python backend, opens window
npx tauri dev

# Production build (creates installer/bundle)
npx tauri build

# Package Python backend as standalone exe (PowerShell)
.\build_backend.ps1
```

Rust checks (run from `src-tauri/`):
```bash
cargo check          # Quick compilation check
cargo clippy         # Lint
cargo fmt            # Format
```

Python service runs standalone for debugging:
```bash
cd python-service
pip install -r requirements.txt
python server.py 51700   # Port is required arg
```

## Architecture

```
Frontend (src/main.js)
  │  window.__TAURI__.core.invoke()
  ▼
Rust (src-tauri/src/lib.rs)  ── HTTP reqwest ──>  Python Flask (python-service/server.py)
  │                                                127.0.0.1:<dynamic_port>
  │  Process manager: spawns Python on free port,
  │  proxies all commands via HTTP, kills on window close
```

The Rust layer is a thin HTTP proxy. All AI inference and image processing happens in Python. Frontend is vanilla JS with `withGlobalTauri: true` (no npm Tauri API imports, no bundler).

### Data Flow

1. User selects a garment style (cx/dk/dx/tx white templates) and a fabric (fabric1-17)
2. The pre-generated garment+fabric image is loaded from `kuanshi/` and shown as preview
3. User selects a landscape → KMeans (k=15) → hue sort → maxminc selection extracts 6 diverse colors
4. User can switch between extracted palette and manual color picker
5. Recoloring: the kuanshi image → RGB→Lab → FeatureEncoder → RecoloringDecoder (palette injection) → Lab→RGB
6. White background preservation: pixels where all RGB channels > 240 are restored to white after recoloring

### Tauri Commands (Rust → Python HTTP proxy)

| Command | HTTP Endpoint |
|---------|--------------|
| `get_styles` | `GET /api/styles` |
| `get_style_image` | `GET /api/style_image/{name}` |
| `get_fabrics` | `GET /api/fabrics` |
| `get_fabric_image` | `GET /api/fabric_image/{name}` |
| `get_kuanshi_image` | `GET /api/kuanshi_image/{style}/{fabric}` |
| `get_landscapes` | `GET /api/landscapes` |
| `get_landscape_image` | `GET /api/landscape_image/{name}` |
| `extract_landscape_palette` | `POST /api/extract_landscape_palette` |
| `recolor` | `POST /api/recolor` |
| `check_service` | `GET /api/health` |
| `save_result` | Local only (base64→PNG in Downloads) |

### Key Files

- `src/main.js` — All frontend logic (no framework, single file)
- `src/index.html` — Single-page layout with sidebar + main area
- `src-tauri/src/lib.rs` — Rust process manager and HTTP proxy
- `python-service/server.py` — Flask API + PyTorch models + palette extraction

### Resource Directories

- `python-service/style/` — 4 white garment templates (cx.jpg, dk.jpg, dx.jpg, tx.jpg)
- `python-service/fabric/` — 17 fabric textures (fabric1-17.jpg)
- `python-service/kuanshi/` — 68 pre-generated combinations: fabric{N}_{style}.png
- `python-service/fengjing/` — 60 landscape images (palette source)
- `python-service/models/` — `FE.state_dict.pt`, `RD.state_dict.pt`

### Kuanshi Naming Convention

Files are named `fabric{N}_{style_code}.png`:
- fabric1_cx.png = fabric1 applied to cx (长袖)
- fabric3_dk.png = fabric3 applied to dk (短裤)
- Complete coverage: 17 fabrics × 4 styles = 68 images

## Build & Packaging

- Dev mode (`npx tauri dev`): Rust finds `python-service/server.py` relative to Cargo manifest and runs `python server.py <port>`
- Production: `build_backend.ps1` creates `python-service/dist/server_backend/server_backend.exe` via PyInstaller. Rust searches multiple candidate paths for this exe at runtime.
- Bundle config in `tauri.conf.json` includes `"../python-service/**/*"` as resources

## Neural Network Details

- **FeatureEncoder**: Conv2d(3→64) → InstanceNorm → MaxPool → 3 ResNetBasicBlocks (64→128→256→512). Outputs 4 multi-scale feature maps (c1–c4).
- **RecoloringDecoder**: Takes c1–c4 + 6-color palette (18 channels, Lab normalized) + illumination. Uses ConvTranspose2d upsampling with skip connections and palette injection at each scale. Final output: 2 channels (a,b in Lab).
- **Inference**: `Lab = [(L+1)*50, (a_tanh)*128, (b_tanh)*128]` where L is the original illumination channel preserved as-is.
- **White bg preservation**: After recoloring, pixels with original RGB all > 240 are reset to [255,255,255].
