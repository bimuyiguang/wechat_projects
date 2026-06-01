const { invoke } = window.__TAURI__.core;

let styles = [], fabrics = [], landscapes = [];
let selectedStyleIdx = 0, selectedFabricIdx = 0, selectedLandscapeIdx = 0;
let extractedPalette = [], manualPalette = [];
let lastRecolorResultBase64 = "";

const STYLE_NAMES = { cx: "长袖", dk: "短裤", dx: "短袖", tx: "T恤" };

function rgbToHex(rgb) {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function hslToRgb(h, s, l) {
  const sn = s / 100, ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function getPaletteMode() {
  return document.getElementById("palette-mode").value;
}

function getActivePalette() {
  return getPaletteMode() === "manual" ? manualPalette : extractedPalette;
}

function getPaletteLabel() {
  if (getPaletteMode() === "manual") return "manual";
  return (landscapes[selectedLandscapeIdx] || "landscape").replace(/\.\w+$/, "");
}

async function waitForService(retries = 60) {
  const el = document.getElementById("service-status");
  for (let i = 0; i < retries; i++) {
    if (await invoke("check_service")) {
      el.textContent = "服务已连接";
      el.style.color = "var(--success)";
      return true;
    }
    el.textContent = `等待服务启动... (${i + 1}/${retries})`;
    await new Promise((r) => setTimeout(r, 1000));
  }
  el.textContent = "服务连接失败，请检查 Python 服务";
  el.style.color = "#f44";
  return false;
}

// --- Generic grid renderer ---

function renderGrid(containerId, items, selectedIdx, itemClass, invokeCmd, invokeParam, labelFn, onClick) {
  const grid = document.getElementById(containerId);
  grid.innerHTML = "";
  items.forEach((name, idx) => {
    const item = document.createElement("div");
    item.className = `${itemClass}${idx === selectedIdx ? " selected" : ""}`;

    const img = document.createElement("img");
    img.alt = name;
    img.loading = "lazy";
    item.appendChild(img);

    const label = document.createElement("span");
    label.className = "style-label";
    label.textContent = labelFn(name);
    item.appendChild(label);

    item.addEventListener("click", () => onClick(idx));
    grid.appendChild(item);

    invoke(invokeCmd, { [invokeParam]: name })
      .then((b64) => { img.src = `data:image/jpeg;base64,${b64}`; })
      .catch((err) => { console.warn(`Failed to load ${name}:`, err); });
  });
}

function selectGridItem(containerId, itemClass, idx) {
  document.querySelectorAll(`#${containerId} .${itemClass}`).forEach((el, i) => {
    el.classList.toggle("selected", i === idx);
  });
}

// --- Style / Fabric / Landscape ---

function renderStyleGrid() {
  document.getElementById("style-count").textContent = `(${styles.length})`;
  renderGrid("style-grid", styles, selectedStyleIdx, "style-item",
    "get_style_image", "name",
    (n) => STYLE_NAMES[n.replace(/\.\w+$/, "")] || n.replace(/\.\w+$/, ""),
    (idx) => { selectedStyleIdx = idx; selectGridItem("style-grid", "style-item", idx); updateOriginalPreview(); }
  );
}

function renderFabricGrid() {
  document.getElementById("fabric-count").textContent = `(${fabrics.length})`;
  renderGrid("fabric-grid", fabrics, selectedFabricIdx, "fabric-item",
    "get_fabric_image", "name",
    (n) => n.replace(/\.\w+$/, ""),
    (idx) => { selectedFabricIdx = idx; selectGridItem("fabric-grid", "fabric-item", idx); updateOriginalPreview(); }
  );
}

function renderLandscapeGrid() {
  document.getElementById("landscape-count").textContent = `(${landscapes.length})`;
  renderGrid("landscape-grid", landscapes, selectedLandscapeIdx, "style-item",
    "get_landscape_image", "name",
    (n) => n.replace(/\.\w+$/, ""),
    (idx) => { selectedLandscapeIdx = idx; selectGridItem("landscape-grid", "style-item", idx); extractPalette(); }
  );
  extractPalette();
}

async function updateOriginalPreview() {
  try {
    const b64 = await invoke("get_kuanshi_image", {
      style: styles[selectedStyleIdx], fabric: fabrics[selectedFabricIdx],
    });
    document.getElementById("result-original").src = `data:image/png;base64,${b64}`;
  } catch (err) {
    console.error("Preview error:", err);
  }
}

// --- Palette ---

async function extractPalette() {
  const container = document.getElementById("extracted-palette");
  if (!landscapes.length) return;
  container.innerHTML = '<span class="loading-text">提取中...</span>';
  try {
    extractedPalette = await invoke("extract_landscape_palette", { landscapeName: landscapes[selectedLandscapeIdx] });
    if (!manualPalette.length) {
      manualPalette = extractedPalette.map((rgb) => [...rgb]);
      renderManualPaletteEditor();
    }
    if (getPaletteMode() === "landscape") renderPaletteDisplay(container, extractedPalette);
  } catch (err) {
    extractedPalette = [];
    container.innerHTML = `<span class="error-text">提取失败: ${err}</span>`;
  }
}

function initManualPalette() {
  manualPalette = extractedPalette.length
    ? extractedPalette.map((rgb) => [...rgb])
    : Array.from({ length: 6 }, (_, i) => hslToRgb(Math.round((i / 6) * 360), 75, 60));
  renderManualPaletteEditor();
  renderActivePalette();
}

function renderManualPaletteEditor() {
  const editor = document.getElementById("manual-palette");
  editor.innerHTML = "";
  manualPalette.forEach((rgb, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "color-field";

    const label = document.createElement("label");
    label.textContent = `色块 ${idx + 1}`;
    wrapper.appendChild(label);

    const input = document.createElement("input");
    input.type = "color";
    input.value = rgbToHex(rgb);
    const hex = document.createElement("span");
    hex.className = "hex-label";
    hex.textContent = rgbToHex(rgb).toUpperCase();
    input.addEventListener("input", (e) => {
      manualPalette[idx] = hexToRgb(e.target.value);
      hex.textContent = e.target.value.toUpperCase();
      if (getPaletteMode() === "manual") renderActivePalette();
    });
    wrapper.appendChild(input);
    wrapper.appendChild(hex);
    editor.appendChild(wrapper);
  });
}

function renderPaletteDisplay(container, palette) {
  container.innerHTML = "";
  palette.forEach(([r, g, b]) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch-lg";
    swatch.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    swatch.title = `RGB(${r}, ${g}, ${b})`;
    container.appendChild(swatch);
  });
}

function renderActivePalette() {
  const palette = getActivePalette();
  if (palette.length === 6) renderPaletteDisplay(document.getElementById("extracted-palette"), palette);
}

function handlePaletteModeChange() {
  const mode = getPaletteMode();
  document.getElementById("landscape-picker").classList.toggle("hidden", mode !== "landscape");
  document.getElementById("manual-palette-editor").classList.toggle("hidden", mode !== "manual");
  renderActivePalette();
}

// --- Recolor & Save ---

async function doRecolor() {
  const palette = getActivePalette();
  if (palette.length !== 6) { alert("请先准备 6 色调色板"); return; }

  const loading = document.getElementById("loading");
  const results = document.getElementById("results");
  const placeholder = document.getElementById("placeholder");
  const saveBtn = document.getElementById("save-btn");

  loading.classList.remove("hidden");
  results.classList.add("hidden");
  placeholder.classList.add("hidden");
  saveBtn.classList.add("hidden");
  document.getElementById("loading-text").textContent = "正在生成重着色结果...";

  try {
    const resp = await invoke("recolor", {
      styleName: styles[selectedStyleIdx],
      fabricName: fabrics[selectedFabricIdx],
      paletteRgb: palette,
    });
    lastRecolorResultBase64 = resp.recolor_image;
    document.getElementById("result-recolor").src = `data:image/png;base64,${resp.recolor_image}`;
    results.classList.remove("hidden");
    saveBtn.classList.remove("hidden");
  } catch (err) {
    alert(`重着色失败: ${err}`);
    placeholder.classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
  }
}

async function doSave() {
  if (!lastRecolorResultBase64) return;
  try {
    const paths = await invoke("save_result", {
      imageBase64: lastRecolorResultBase64,
      styleName: styles[selectedStyleIdx],
      fabricName: fabrics[selectedFabricIdx],
      paletteLabel: getPaletteLabel(),
    });
    alert(`保存成功:\n${paths.join("\n")}`);
  } catch (err) {
    alert(`保存失败: ${err}`);
  }
}

// --- Init ---

async function init() {
  if (!await waitForService()) return;
  try {
    [styles, fabrics, landscapes] = await Promise.all([
      invoke("get_styles"), invoke("get_fabrics"), invoke("get_landscapes"),
    ]);
    renderStyleGrid();
    renderFabricGrid();
    renderLandscapeGrid();
    initManualPalette();
    document.getElementById("palette-section").classList.remove("hidden");
    document.getElementById("recolor-btn").disabled = false;
  } catch (err) {
    console.error("Init error:", err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("palette-mode").addEventListener("change", handlePaletteModeChange);
  document.getElementById("use-current-palette").addEventListener("click", () => {
    document.getElementById("palette-mode").value = "landscape";
    handlePaletteModeChange();
  });
  document.getElementById("sync-manual-palette").addEventListener("click", () => {
    if (!extractedPalette.length) return;
    manualPalette = extractedPalette.map((rgb) => [...rgb]);
    renderManualPaletteEditor();
    if (getPaletteMode() === "manual") renderActivePalette();
  });
  document.getElementById("recolor-btn").addEventListener("click", doRecolor);
  document.getElementById("save-btn").addEventListener("click", doSave);
  init();
});
