# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**PaletteFusionNet** ("AI 面料智能重着色工具") is a Tauri v2 desktop application that recolors fabric images using color palettes extracted from landscape photographs. It uses a PyTorch neural network (FeatureEncoder + RecoloringDecoder) for inference.

## Tech Stack

- **Desktop shell:** Tauri v2 (Rust)
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no bundler — served directly from `src/`)
- **AI backend:** Python 3, Flask, PyTorch, OpenCV, scikit-learn
- **Packaging:** PyInstaller for Python backend, Tauri bundler for the app

## Commands

```bash
npm install                # Install Tauri CLI
npx tauri dev              # Dev mode: compiles Rust, spawns Python, opens window
npx tauri build            # Production build (installer/bundle)
```

Python backend packaging:
```powershell
.\build_backend.ps1        # Creates standalone server_backend.exe via PyInstaller
```

ONNX model export:
```bash
python export_onnx.py      # Exports PyTorch models to ONNX format
```

## Architecture

```
Frontend (src/main.js)
  └── window.__TAURI__.core.invoke() ── Tauri IPC ──> Rust (src-tauri/src/lib.rs)
                                                         │
                                                         │ HTTP (reqwest blocking)
                                                         │ 127.0.0.1:<dynamic_port>
                                                         v
                                                   Python Flask (python-service/server.py)
```

**Key design:** The Rust layer is a process manager and HTTP proxy — it spawns the Python Flask server on a dynamically-allocated port at startup, forwards all Tauri commands as HTTP requests to Flask, and kills the Python process on window close. All AI inference and image processing happens in Python.

### Frontend (`src/`)

- `main.js` — All UI logic. Uses `withGlobalTauri: true` (no npm Tauri API imports needed). Calls Tauri commands via `window.__TAURI__.core.invoke()`.
- `styles.css` — Dark theme with CSS variables (`--bg: #0f0f0f`, `--accent: #4a9eff`).
- `index.html` — Single-page layout: sidebar (fabric selector, landscape grid, palette, recolor button) + main area (results display).

### Rust layer (`src-tauri/src/lib.rs`)

- `AppState` holds HTTP client, Python readiness flag, child process handle, and port.
- `setup()` finds a free port, spawns `python server.py <port>`, stores state.
- 8 Tauri commands proxy to Flask endpoints (`/api/fabrics`, `/api/landscapes`, `/api/recolor`, etc.).
- `save_result` is the only command handled locally (base64 decode → PNG in Downloads).

### Python AI backend (`python-service/server.py`)

- **FeatureEncoder:** Conv2d → InstanceNorm → ResNet blocks (64→128→256→512). Produces 4 multi-scale feature maps.
- **RecoloringDecoder:** Takes features + 6-color palette (Lab space) + illumination. ConvTranspose2d upsampling with skip connections and palette injection.
- **Palette extraction:** KMeans (k=15) on RGB pixels → sort by hue → maxminc selection (6 diverse colors).
- **Inference flow:** RGB → Lab → FeatureEncoder → RecoloringDecoder → Lab → RGB → base64 PNG.

### Resource files

- `python-service/mianliao/` — 17 fabric images (bundled)
- `python-service/fengjing/` — 60 landscape images (bundled)
- `python-service/models/` — PyTorch weights (`FE.state_dict.pt`, `RD.state_dict.pt`)
- `src-tauri/resources/` — Fabrics also copied here for Tauri bundling

## Configuration Notes

- `tauri.conf.json`: `frontendDist: "../src"` (no Vite/Webpack), `withGlobalTauri: true`, CSP disabled (`null`).
- `tauri.conf.json` `bundle.resources` includes `"../python-service/**/*"` so Python service is bundled with the app.
- Python dependencies are in `python-service/requirements.txt`.
