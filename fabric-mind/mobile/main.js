const api = (path, options) => fetch(path, {
  headers: { "content-type": "application/json" },
  ...options
}).then((res) => res.json());

const state = {
  page: "generate",
  assets: [],
  tasks: [],
  selectedAsset: null,
  activeTask: null,
  activeVideoTask: null,
  videos: [],
  mode: "整套换装",
  prompt: "保持脸部和背景不变，让服装自然贴合身体"
};

const personUrl = "/public/home/person-default.png";
const garmentUrl = "/public/home/garment-default.png";
const appRoot = document.querySelector("#app");

function renderTop(title, sub = "") {
  return `<div class="top"><div class="brand"><h1>${title}</h1><p>${sub}</p></div><span class="pill">128 积分</span></div>`;
}

function assetCard(item) {
  return `
    <article class="asset-card" data-asset="${item.id}">
      <img class="asset-img fit" src="${item.url}" alt="${item.name}">
      <div class="asset-meta">
        <strong>${item.name}</strong>
        <span>${item.type} · ${item.color} · ${item.style}</span>
      </div>
    </article>
  `;
}

function renderGenerate() {
  appRoot.innerHTML = `
    ${renderTop("FabricMind", "AI 试衣生成")}
    <section class="card">
      <div class="card-head"><h2>人物照片</h2><span class="hint">图片 A</span></div>
      <div class="image-drop fit"><img src="${personUrl}" alt="人物照片"></div>
      <div class="actions"><button class="soft-btn">上传照片</button><button class="soft-btn">从模特库选择</button></div>
    </section>
    <section class="card">
      <div class="card-head"><h2>服装素材</h2><span class="hint">图片 B</span></div>
      <div class="image-drop fit"><img src="${state.selectedAsset?.url || garmentUrl}" alt="服装素材"></div>
      <div class="actions"><button class="soft-btn" data-go="assets">选择素材</button><button class="soft-btn">上传衣服</button></div>
    </section>
    <div class="seg">
      ${["上衣试穿", "下装试穿", "整套换装", "自定义编辑"].map((x) => `<button class="${x === state.mode ? "active" : ""}" data-mode="${x}">${x}</button>`).join("")}
    </div>
    <section class="card">
      <div class="card-head"><h2>生成要求</h2><span class="hint">可追加</span></div>
      <textarea id="prompt">${state.prompt}</textarea>
      <div class="chips"><span class="chip">保留原背景</span><span class="chip">不改变脸</span><span class="chip">增强面料纹理</span></div>
    </section>
    <button class="primary" id="generateBtn">开始生成</button>
  `;
}

function renderAssets() {
  appRoot.innerHTML = `
    <div class="page-title"><h1>选择服装素材</h1><p>从管理员素材库选择，也可以后续接入上传</p></div>
    <div class="filters">
      ${["全部", "上衣", "下装", "面料"].map((x, i) => `<button class="${i === 0 ? "active" : ""}">${x}</button>`).join("")}
    </div>
    <div class="asset-grid">${state.assets.map(assetCard).join("")}</div>
  `;
}

function renderTask() {
  const t = state.activeTask || {};
  const v = state.activeVideoTask || {};
  const isVideoFlow = Boolean(v.id);
  appRoot.innerHTML = `
    <div class="page-title"><h1>${isVideoFlow ? "正在生成展示视频" : "正在生成"}</h1><p>图片任务 ${t.id || ""}${v.id ? ` · 视频任务 ${v.id}` : ""}</p></div>
    <section class="card">
      <div class="compare">
        <div class="mini-preview"><img src="${t.personUrl || personUrl}" alt=""></div>
        <div class="mini-preview"><img src="${isVideoFlow ? (t.resultUrl || v.posterUrl || personUrl) : (t.garmentUrl || garmentUrl)}" alt=""></div>
      </div>
      <div class="steps">
        <div class="step done"><span class="dot"></span>已上传图片</div>
        <div class="step ${t.status === "success" ? "done" : ""}"><span class="dot"></span>图片生成${t.status === "success" ? "完成" : "中"}</div>
        <div class="step ${!isVideoFlow ? "" : v.status === "success" ? "done" : ""}"><span class="dot"></span>${isVideoFlow ? `视频${v.status === "success" ? "生成完成" : "生成中"}` : "等待视频生成"}</div>
      </div>
      <p class="hint">${isVideoFlow ? `视频进度：${v.progress || 0}% · 图片已完成，MP4 生成后进入结果页` : `当前进度：${t.progress || 0}% · 本次消耗 8 积分`}</p>
    </section>
    <button class="soft-btn" data-go="history">稍后在历史记录查看</button>
  `;
}

function renderResult(task) {
  const t = task || state.activeTask || state.tasks[0];
  const videoTask = state.activeVideoTask && state.activeVideoTask.sourceTaskId === t?.id ? state.activeVideoTask : null;
  appRoot.innerHTML = `
    <div class="page-title"><h1>生成结果</h1><p>${t?.mode || "整套换装"} · ${t?.createdAt || ""}</p></div>
    <div class="result-main"><img src="${t?.resultUrl || personUrl}" alt="结果图"></div>
    <div class="thumbs">
      <div class="thumb"><img src="${t?.personUrl || personUrl}" alt=""></div>
      <div class="thumb"><img src="${t?.garmentUrl || garmentUrl}" alt=""></div>
      <div class="thumb"><img src="${t?.resultUrl || personUrl}" alt=""></div>
    </div>
    <section class="card">
      <h2>生成要求</h2>
      <p class="hint">${t?.prompt || state.prompt}</p>
    </section>
    <section class="card">
      <div class="card-head"><h2>展示视频</h2><span class="hint">${videoTask ? videoTask.status : "可选"}</span></div>
      ${renderVideoPreview(videoTask, t)}
      <div class="actions">
        <button class="soft-btn" data-video-task="${t?.id || ""}">生成视频</button>
        <button class="soft-btn" data-go="history">查看记录</button>
      </div>
    </section>
    <div class="actions"><button class="soft-btn">保存图片</button><button class="primary" data-go="generate">再生成一次</button></div>
  `;
}

function renderVideoPreview(videoTask, imageTask) {
  if (!videoTask) {
    return `<div class="video-card image-video-preview"><img src="${imageTask?.resultUrl || personUrl}" alt="视频首帧"><span>点击生成 5 秒展示视频</span></div>`;
  }
  if (videoTask.status !== "success") {
    return `<div class="video-card image-video-preview"><img src="${videoTask.posterUrl}" alt="视频生成中"><span>视频生成中 ${videoTask.progress || 0}%</span></div>`;
  }
  if (videoTask.videoUrl) {
    return `<video class="video-card" src="${videoTask.videoUrl}" poster="${videoTask.posterUrl}" controls autoplay muted loop playsinline></video>`;
  }
  return `<div class="video-card image-video-preview animated"><img src="${videoTask.posterUrl}" alt="展示视频"><span>动态展示预览</span></div>`;
}

function renderHistory() {
  appRoot.innerHTML = `
    <div class="page-title"><h1>我的生成</h1><p>查看所有生成记录和状态</p></div>
    <div class="filters"><button class="active">全部</button><button>成功</button><button>生成中</button><button>失败</button></div>
    <div class="history-grid">
      ${state.tasks.map((t) => `
        <article class="asset-card" data-task="${t.id}">
          <img class="asset-img" src="${t.resultUrl || t.personUrl}" alt="">
          <div class="asset-meta"><strong>${t.mode}</strong><span>${t.status} · ${t.createdAt}</span></div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderProfile() {
  appRoot.innerHTML = `
    ${renderTop("我的", "个人中心")}
    <section class="card">
      <div class="top">
        <div class="brand"><h1>演示用户</h1><p>ID u001 · 连续签到 3 天</p></div>
        <span class="pill">签到 +5</span>
      </div>
      <div class="stats">
        <div class="stat"><strong>128</strong><span>当前积分</span></div>
        <div class="stat"><strong>24</strong><span>总生成</span></div>
        <div class="stat"><strong>21</strong><span>成功</span></div>
      </div>
    </section>
    <section class="card">
      <h2>积分规则</h2>
      <p class="hint">每日签到获得积分，生成消耗积分，失败任务自动返还。</p>
    </section>
    <section class="card">
      <h2>功能入口</h2>
      <div class="chips"><span class="chip">我的积分</span><span class="chip">生成记录</span><span class="chip">意见反馈</span><span class="chip">关于 FabricMind</span></div>
    </section>
  `;
}

function setPage(page) {
  state.page = page;
  document.querySelectorAll(".tabbar button").forEach((btn) => btn.classList.toggle("active", btn.dataset.page === page));
  if (page === "generate") renderGenerate();
  if (page === "assets") renderAssets();
  if (page === "task") renderTask();
  if (page === "result") renderResult();
  if (page === "history") renderHistory();
  if (page === "profile") renderProfile();
}

async function pollTask(id) {
  const task = await api(`/api/tasks/${id}`);
  state.activeTask = task;
  if (state.page === "task") renderTask();
  if (task.status === "success") {
    state.tasks = (await api("/api/me/history")).items;
    setPage("result");
  } else {
    setTimeout(() => pollTask(id), 900);
  }
}

async function pollVideoTask(id) {
  const videoTask = await api(`/api/videos/${id}`);
  state.activeVideoTask = videoTask;
  if (state.page === "task") renderTask();
  if (videoTask.status !== "success" && videoTask.status !== "failed") {
    setTimeout(() => pollVideoTask(id), 1500);
  } else {
    state.videos = (await api("/api/me/videos")).items;
    setPage("result");
  }
}

document.addEventListener("click", async (event) => {
  const go = event.target.closest("[data-go]")?.dataset.go;
  if (go) return setPage(go);

  const tab = event.target.closest(".tabbar button");
  if (tab) return setPage(tab.dataset.page);

  const mode = event.target.closest("[data-mode]")?.dataset.mode;
  if (mode) {
    state.mode = mode;
    renderGenerate();
    return;
  }

  const assetId = event.target.closest("[data-asset]")?.dataset.asset;
  if (assetId) {
    state.selectedAsset = state.assets.find((x) => x.id === assetId);
    setPage("generate");
    return;
  }

  const taskId = event.target.closest("[data-task]")?.dataset.task;
  if (taskId) {
    const task = state.tasks.find((x) => x.id === taskId);
    state.activeTask = task;
    renderResult(task);
    return;
  }

  const sourceTaskId = event.target.closest("[data-video-task]")?.dataset.videoTask;
  if (sourceTaskId) {
    const task = state.tasks.find((x) => x.id === sourceTaskId) || state.activeTask;
    state.activeTask = task;
    const resp = await api("/api/videos", {
      method: "POST",
      body: JSON.stringify({
        sourceTaskId,
        imageUrl: task?.resultUrl,
        fallbackToMock: false,
        title: "结果图展示视频",
        prompt: "Generate a short fashion showcase video from the result image. Use a subtle runway camera push-in, keep the outfit, face, body pose and background consistent, emphasize garment texture and premium fashion presentation."
      })
    });
    state.activeVideoTask = resp.videoTask;
    setPage("task");
    pollVideoTask(resp.videoTaskId);
    return;
  }

  if (event.target.id === "generateBtn") {
    state.prompt = document.querySelector("#prompt").value.trim() || state.prompt;
    const resp = await api("/api/generation/try-on", {
      method: "POST",
      body: JSON.stringify({
        mode: state.mode,
        prompt: state.prompt,
        personUrl,
        garmentUrl: state.selectedAsset?.url || garmentUrl,
        fallbackToMock: false
      })
    });
    state.activeTask = resp.task;
    setPage("task");
    pollTask(resp.taskId);
  }
});

async function boot() {
  state.assets = (await api("/api/assets")).items;
  state.tasks = (await api("/api/me/history")).items;
  state.videos = (await api("/api/me/videos")).items;
  setPage("generate");
}

boot();
