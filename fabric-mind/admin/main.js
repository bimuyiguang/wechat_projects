// Keep route keys stable; only change labels/groups when separating admin modules.
const navSections = [
  {
    title: "小程序 / AI 生成",
    items: [
      ["概览", "运营概览"],
      ["素材库", "AI素材库"],
      ["用户管理", "小程序用户"],
      ["用户图片", "用户图片"],
      ["生成任务", "AI生成任务"],
      ["结果图库", "AI结果图库"],
      ["视频任务", "AI视频任务"],
      ["模型配置", "AI模型配置"]
    ]
  },
  {
    title: "电商 / 订单",
    items: [
      ["商品管理", "电商商品"],
      ["订单管理", "电商订单"],
      ["评价管理", "电商评价"]
    ]
  },
  {
    title: "面料 / 系统",
    items: [
      ["面料工作台", "面料工作台"],
      ["设置", "OSS与系统设置"]
    ]
  }
];
const navItems = navSections.flatMap((section) => section.items.map(([key]) => key));
const navLabelMap = Object.fromEntries(navSections.flatMap((section) => section.items));

function navLabel(key) {
  return navLabelMap[key] || key;
}

const data = {
  assets: [],
  tasks: [],
  users: [],
  videos: [],
  shopOrders: [],
  shopReviews: [],
  styles: [],
  fabrics: [],
  modelConfig: null,
  storageConfig: null,
  videoConfig: null,
  activeTask: null,
  activeUser: null,
  activeAsset: null,
  activeVideoTask: null,
  activeModelTask: null
};

const initialView = new URLSearchParams(location.search).get("view");
const initialViewKey = navItems.includes(initialView)
  ? initialView
  : Object.entries(navLabelMap).find(([, label]) => label === initialView)?.[0];
let current = initialViewKey || "概览";
const navRoot = document.querySelector("#nav");
const viewRoot = document.querySelector("#view");
const searchState = { q: "", type: "" };
let refreshing = false;
const fabricTool = {
  baseUrl: localStorage.getItem("fabricLocalServiceUrl") || "http://127.0.0.1:5188",
  connected: false,
  styles: [],
  fabrics: [],
  templates: [],
  landscapes: [],
  selectedStyle: "",
  selectedFabric: "",
  selectedTemplate: "",
  selectedLandscape: "",
  palette: [],
  originalBase64: "",
  referenceBase64: "",
  uploadedReferenceName: "",
  customBase64: "",
  customBaseName: "",
  useCustomBase: false,
  preserveWhiteBackground: true,
  resultBase64: "",
  message: "等待连接本机 Python 面料服务"
};

async function api(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { "content-type": "application/json" };
  const res = await fetch(path, { headers, ...options });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    location.href = "/admin/login";
    throw new Error(body.message || "登录已过期");
  }
  if (!res.ok) throw new Error(body.message || `${path} ${res.status}`);
  return body;
}

function mediaUrl(url) {
  return url || "";
}

function assetDisplayUrl(asset = {}) {
  return asset.displayUrl || asset.fullUrl || asset.ossUrl || asset.url || "";
}

function assetCopyUrl(asset = {}) {
  return asset.apiUrl || asset.ossUrl || asset.url || "";
}

function assetStorageLabel(asset = {}) {
  const url = assetCopyUrl(asset);
  if (asset.ossUrl || /^https?:\/\//.test(url)) return `<span class="storage-pill cloud">OSS / 云端</span>`;
  return `<span class="storage-pill local">本地</span>`;
}

function pageHead(title, desc, action = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="head-actions">${action}</div></div>`;
}

function statusLabel(status) {
  const map = { success: "已完成", running: "生成中", queued: "排队中", failed: "失败", "上架": "上架" };
  const cls = status === "success" || status === "上架" ? "success" : status === "failed" ? "failed" : "";
  return `<span class="status ${cls}">${map[status] || status || "-"}</span>`;
}

function copyText(text) {
  navigator.clipboard?.writeText(text);
  toast("已复制 URL");
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function setRefreshing(value) {
  refreshing = value;
  document.body.classList.toggle("is-refreshing", value);
}

function providerName(provider) {
  const map = {
    dashscope: "阿里 DashScope",
    doubao: "火山豆包",
    volcengine: "火山豆包",
    dashscopeTryOn: "阿里试衣",
    mock: "本地演示"
  };
  return map[provider] || provider || "-";
}

function taskModel(task) {
  return task.modelName || task.wanInput?.model || task.doubaoInput?.model || task.providerTaskPayload?.model || (task.provider === "dashscope" ? "wan2.5-i2i-preview" : task.provider === "doubao" ? "doubao-seedream-4-5-251128" : "-");
}

function taskSize(task) {
  return task.wanInput?.size || task.doubaoInput?.size || task.providerTaskPayload?.resolution || "-";
}

function shortUrl(url) {
  if (!url) return "-";
  if (url.length <= 48) return url;
  return `${url.slice(0, 26)}...${url.slice(-16)}`;
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function primaryUser() {
  return data.users[0] || {};
}

function displayUserName(task = {}) {
  const user = data.users.find((item) => item.id === task.userId)
    || (task.user === "演示用户" ? primaryUser() : null)
    || data.users.find((item) => item.name === task.user || item.nickName === task.user);
  return user?.name || user?.nickName || task.user || "微信用户";
}

function displayUserAvatar(task = {}) {
  const user = data.users.find((item) => item.id === task.userId)
    || (task.user === "演示用户" ? primaryUser() : null);
  return user?.fullAvatarUrl || user?.avatarUrl || task.userAvatarUrl || "";
}

function imageOrMissing(url, alt = "图片", className = "") {
  const src = mediaUrl(url);
  if (!src) return `<div class="${className} missing-image">缺图</div>`;
  return `<img${className ? ` class="${className}"` : ""} src="${src}" alt="${alt}">`;
}

function includesQuery(parts, q = searchState.q) {
  if (!q) return true;
  const haystack = parts.map(normalizeText).join(" ");
  return haystack.includes(normalizeText(q));
}

function filterByGlobalType(kind) {
  return !searchState.type || searchState.type === kind;
}

function filterAssetsByGlobal(items = data.assets) {
  if (!filterByGlobalType("asset")) return [];
  return items.filter((asset) => includesQuery([asset.id, asset.name, asset.type, asset.color, asset.style, asset.status, asset.url]));
}

function filterUsersByGlobal(items = data.users) {
  if (!filterByGlobalType("user")) return [];
  return items.filter((user) => includesQuery([user.id, user.name, user.nickName, user.points, user.total, user.success, user.avatarUrl]));
}

function filterTasksByGlobal(items = data.tasks, kind = "task") {
  if (!filterByGlobalType(kind)) return [];
  return items.filter((task) => includesQuery([
    task.id,
    displayUserName(task),
    task.mode,
    task.status,
    task.provider,
    providerName(task.provider),
    taskModel(task),
    task.resultUrl,
    task.createdAt
  ]));
}

function filterVideosByGlobal(items = data.videos) {
  if (!filterByGlobalType("video")) return [];
  return items.filter((video) => includesQuery([
    video.id,
    video.sourceTaskId,
    video.status,
    video.provider,
    providerName(video.provider),
    video.modelName || video.providerTaskPayload?.model,
    video.videoUrl,
    video.createdAt
  ]));
}

function renderOverview() {
  const visibleTasks = filterTasksByGlobal(data.tasks);
  const visibleAssets = filterAssetsByGlobal(data.assets);
  const successCount = visibleTasks.filter((x) => x.status === "success").length;
  viewRoot.innerHTML = `
    ${pageHead("运营概览", "查看小程序素材、AI 生成任务、视频和 OSS 状态")}
    <div class="cards">
      <div class="metric"><span>素材数量</span><strong>${visibleAssets.length}</strong></div>
      <div class="metric"><span>生成任务</span><strong>${visibleTasks.length}</strong></div>
      <div class="metric"><span>成功结果</span><strong>${successCount}</strong></div>
      <div class="metric"><span>视频任务</span><strong>${filterVideosByGlobal(data.videos).length}</strong></div>
    </div>
    <div class="grid2">
      <section class="panel"><h2>最近任务</h2>${taskTable(visibleTasks.slice(0, 6))}</section>
      <section class="panel"><h2>最新素材</h2>${assetGrid(visibleAssets.slice(0, 4))}</section>
    </div>
  `;
}

function assetGrid(items = data.assets) {
  if (!items.length) return `<p class="muted">暂无素材。</p>`;
  return `<div class="asset-grid">${items.map((asset) => `
    <article class="asset-card" data-asset-detail="${asset.id}">
      ${imageOrMissing(assetDisplayUrl(asset), asset.name)}
      <div class="body">
        <div class="asset-title-row"><strong>${asset.name}</strong>${assetStorageLabel(asset)}</div>
        <span>${asset.type} · ${asset.color} · ${asset.style}</span>
        <div class="row-actions">
          <button class="ghost" data-copy-url="${assetCopyUrl(asset)}">复制 URL</button>
          <button class="primary" data-asset-detail="${asset.id}">查看</button>
        </div>
      </div>
    </article>
  `).join("")}</div>`;
}

function filterAssets() {
  const q = (document.querySelector("#assetSearch")?.value || "").trim().toLowerCase();
  const t = document.querySelector("#assetTypeFilter")?.value || "";
  let items = filterAssetsByGlobal(data.assets);
  if (q) items = items.filter((a) => a.name.toLowerCase().includes(q));
  if (t) items = items.filter((a) => a.type === t);
  const panel = document.querySelector("#assetGridPanel");
  if (panel) panel.innerHTML = assetGrid(items);
}

function renderAssets() {
  viewRoot.innerHTML = `
    ${pageHead("AI素材库", "上传和管理小程序使用的模特图、上衣、裤子、整套服装、面料素材", `
      <input id="assetUploadInput" type="file" accept="image/*" hidden>
      <button class="ghost" data-nav="面料工作台">本机面料工作台</button>
      <button class="primary" id="uploadAssetBtn">上传素材</button>
    `)}
    <div class="filters">
      <input id="assetSearch" placeholder="搜索素材名称">
      <select id="assetTypeFilter">
        <option value="">全部类型</option><option value="上衣">上衣</option><option value="下装">下装</option><option value="面料">面料</option><option value="人物">人物</option>
      </select>
    </div>
    <section class="panel" id="assetGridPanel">${assetGrid(filterAssetsByGlobal())}</section>
  `;
  document.querySelector("#assetSearch")?.addEventListener("input", filterAssets);
  document.querySelector("#assetTypeFilter")?.addEventListener("change", filterAssets);
}

function renderAssetDetail(asset) {
  data.activeAsset = asset;
  const backNav = asset.sourceView || "素材库";
  const previewUrl = assetDisplayUrl(asset);
  const copyUrl = assetCopyUrl(asset);
  viewRoot.innerHTML = `
    ${pageHead("素材详情", asset.name, `<button class="primary" data-nav="${backNav}">返回${navLabel(backNav)}</button>`)}
    <div class="detail-layout">
      <section class="panel">
        <h2>素材预览</h2>
        ${imageOrMissing(previewUrl, asset.name, "large-preview")}
      </section>
      <section class="panel">
        <h2>素材信息</h2>
        <p>类型：${asset.type}</p>
        <p>颜色：${asset.color}</p>
        <p>风格：${asset.style}</p>
        <p>状态：${asset.status}</p>
        <p>存储：${asset.ossUrl || /^https?:\/\//.test(copyUrl) ? "OSS / 云端" : "本地"}</p>
        ${asset.relatedTaskId ? `<p>关联任务：<code>${asset.relatedTaskId}</code></p>` : ""}
        <p class="url-line">${copyUrl}</p>
        ${asset.localUrl && asset.localUrl !== copyUrl ? `<p class="url-line muted">本地备份：${asset.localUrl}</p>` : ""}
        <div class="row-actions">
          <button class="primary full" data-copy-url="${copyUrl}">复制素材 URL</button>
          ${asset.sourceView === "用户图片" ? `<button class="ghost" data-detail="${asset.relatedTaskId}">查看关联任务</button>` : `<button class="ghost danger" data-delete-asset="${asset.id}">删除素材</button>`}
        </div>
      </section>
    </div>
  `;
}

function maskStr(str) {
  if (!str) return '<span class="muted">-</span>';
  if (str.length <= 8) return str;
  return str.slice(0, 4) + "***" + str.slice(-4);
}

function renderUsers() {
  const users = filterUsersByGlobal();
  viewRoot.innerHTML = `
    ${pageHead("用户管理", "查看统一登录的微信用户信息，包含小程序与网页打通合并详情")}
    <section class="panel">
      <table>
        <thead><tr><th>用户</th><th>UnionID (脱敏)</th><th>小程序 OpenID</th><th>网页 OpenID</th><th>积分</th><th>总生成</th><th>成功生成</th><th>操作</th></tr></thead>
        <tbody>${users.map((user) => `
          <tr>
            <td>
              <div class="user-cell">
                ${imageOrMissing(user.avatarUrl || user.avatar, user.nickName || user.name)}
                <div><strong>${user.nickName || user.name}</strong><span>${user.id}</span></div>
              </div>
            </td>
            <td><code>${maskStr(user.unionid)}</code></td>
            <td><code>${maskStr(user.miniOpenid)}</code></td>
            <td><code>${maskStr(user.webOpenid)}</code></td>
            <td>${user.points}</td><td>${user.total}</td><td>${user.success}</td>
            <td><button class="primary" data-user-detail="${user.id}">查看详情</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
  `;
}

function renderUserDetail(user) {
  data.activeUser = user;
  const userTasks = data.tasks.filter((task) => task.userId === user.id || task.user === user.name);
  const userVideos = data.videos?.filter((video) => video.userId === user.id) || [];
  const userOrders = data.shopOrders?.filter((order) => order.userId === user.id) || [];
  const userReviews = data.shopReviews?.filter((review) => review.userId === user.id || review.userName === user.name) || [];

  const totalSpent = userOrders.filter(o => o.status !== "pending_payment").reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  viewRoot.innerHTML = `
    ${pageHead("用户详情", user.nickName || user.name, `<button class="primary" data-nav="用户管理">返回用户管理</button>`)}
    
    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 16px;">
      <section class="panel user-profile-panel" style="margin-bottom: 0;">
        ${imageOrMissing(user.avatarUrl || user.avatar, user.nickName || user.name)}
        <div>
          <h2>${user.nickName || user.name}</h2>
          <p>用户 ID：${user.id}</p>
          <p>更新时间：${user.updatedAt || "-"}</p>
        </div>
      </section>

      <section class="panel" style="margin-bottom: 0;">
        <h3 style="margin-top: 0; margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 6px;">微信多端关联信息</h3>
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px 16px; font-size: 13px;">
          <strong>微信 UnionID:</strong>
          <code>${user.unionid || '<span class="muted">未绑定</span>'}</code>
          
          <strong>小程序 OpenID:</strong>
          <code>${user.miniOpenid || '<span class="muted">未绑定</span>'}</code>
          
          <strong>网页授权 OpenID:</strong>
          <code>${user.webOpenid || '<span class="muted">未绑定</span>'}</code>
        </div>
      </section>
    </div>

    <div class="cards">
      <div class="metric"><span>可用积分</span><strong>${user.points}</strong></div>
      <div class="metric"><span>AI 生成次数</span><strong>${userTasks.length}</strong><em>次</em></div>
      <div class="metric"><span>AI 视频次数</span><strong>${userVideos.length}</strong><em>次</em></div>
      <div class="metric"><span>消费笔数</span><strong>${userOrders.length}</strong><em>笔</em></div>
      <div class="metric"><span>累计消费</span><strong>¥${totalSpent}</strong><em>元</em></div>
    </div>

    <section class="panel" style="margin-top: 16px;">
      <h2>小程序 AI 换装任务 (${userTasks.length})</h2>
      ${taskTable(userTasks)}
    </section>

    <section class="panel" style="margin-top: 16px;">
      <h2>小程序展示视频任务 (${userVideos.length})</h2>
      ${userVideosTable(userVideos)}
    </section>

    <section class="panel" style="margin-top: 16px;">
      <h2>网页定制成衣订单 (${userOrders.length})</h2>
      ${userOrdersTable(userOrders)}
    </section>

    <section class="panel" style="margin-top: 16px;">
      <h2>定制体验评价反馈 (${userReviews.length})</h2>
      ${userReviewsTable(userReviews)}
    </section>
  `;
}

function userOrdersTable(orders) {
  if (!orders.length) return `<p class="muted">暂无定制订单。</p>`;
  const statusMap = {
    "pending_payment": "待支付",
    "paid": "已支付 / 待发货",
    "shipped": "已发货",
    "completed": "已完成"
  };
  return `
    <table class="task-table">
      <thead>
        <tr>
          <th>订单号</th>
          <th>收件人</th>
          <th>定制成衣款式</th>
          <th>订购数量 & 金额</th>
          <th>状态</th>
          <th>创建时间</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => {
          const style = data.styles?.find(s => s.id === order.styleId) || { name: order.styleId };
          const fabric = data.fabrics?.find(f => f.id === order.fabricId) || { name: order.fabricId, hex: "#ccc" };
          let statusLabelClass = "";
          if (order.status === "pending_payment") statusLabelClass = "failed";
          else if (order.status === "paid" || order.status === "completed") statusLabelClass = "success";
          
          return `
            <tr>
              <td><code>${order.id}</code></td>
              <td>
                <strong>${order.receiver?.fullName || "未填写"}</strong>
                <span class="block muted" style="font-size: 11px;">${order.receiver?.phone || "无电话"}</span>
              </td>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.1); background-color: ${fabric.hex || '#ccc'}; shrink: 0;" title="${fabric.name}"></div>
                  <div>
                    <strong>${style.name || order.styleId}</strong>
                    <span class="block muted" style="font-size: 10px;">面料: ${fabric.name || order.fabricId} · 尺码: ${order.size}</span>
                  </div>
                </div>
              </td>
              <td>
                <strong>${order.quantity} 件</strong>
                <span class="block font-mono text-primary" style="font-size: 11px;">¥${order.amount}</span>
              </td>
              <td>
                <span class="status ${statusLabelClass}">${statusMap[order.status] || order.status}</span>
              </td>
              <td><span style="font-size: 11px;">${order.createdAt || "-"}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function userVideosTable(videos) {
  if (!videos.length) return `<p class="muted">暂无生成视频。</p>`;
  return `
    <table class="task-table">
      <thead>
        <tr>
          <th>视频 ID</th>
          <th>来源生成任务</th>
          <th>状态</th>
          <th>进度</th>
          <th>创建时间</th>
          <th>视频文件</th>
        </tr>
      </thead>
      <tbody>
        ${videos.map(video => `
          <tr>
            <td><code>${video.id}</code></td>
            <td><code>${video.sourceTaskId || "-"}</code></td>
            <td>${statusLabel(video.status)}</td>
            <td>${video.progress}%</td>
            <td><span style="font-size: 11px;">${video.createdAt}</span></td>
            <td>${video.videoUrl ? `<a class="inline-link" href="${video.videoUrl}" target="_blank">播放视频</a>` : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function userReviewsTable(reviews) {
  if (!reviews.length) return `<p class="muted">暂无定制评价。</p>`;
  return `
    <table class="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>购买款式</th>
          <th>面料体验</th>
          <th>穿着评语</th>
          <th>创建时间</th>
        </tr>
      </thead>
      <tbody>
        ${reviews.map(review => {
          const style = data.styles?.find(s => s.id === review.styleId) || { name: review.styleId };
          const fabric = data.fabrics?.find(f => f.id === review.fabricId) || { name: review.fabricId };
          return `
            <tr>
              <td><code>${review.id}</code></td>
              <td><strong>${style.name || review.styleId}</strong></td>
              <td>${fabric.name || review.fabricId}</td>
              <td style="max-width: 300px; white-space: normal; line-height: 1.3;">
                <div style="font-weight: 500;">评分: ${"⭐".repeat(review.rating || 5)}</div>
                <div class="muted" style="margin-top: 4px; font-size: 11px;">${review.comment || review.text || ""}</div>
              </td>
              <td><span style="font-size: 11px;">${review.createdAt || "-"}</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function userImageItems() {
  return data.tasks.flatMap((task) => [
    { id: `${task.id}-person`, relatedTaskId: task.id, sourceView: "用户图片", name: `${task.id} 人物图`, type: "人物", color: "输入图", style: displayUserName(task), status: "上架", url: task.personUrl, ossUrl: task.personOssUrl || "", provider: task.provider },
    { id: `${task.id}-garment`, relatedTaskId: task.id, sourceView: "用户图片", name: `${task.id} 服装图`, type: "服装", color: "输入图", style: task.mode, status: "上架", url: task.garmentUrl, ossUrl: task.garmentOssUrl || "", provider: task.provider },
    ...(task.resultUrl ? [{ id: `${task.id}-result`, relatedTaskId: task.id, sourceView: "用户图片", name: `${task.id} 结果图`, type: "结果", color: "输出图", style: providerName(task.provider), status: "上架", url: task.resultUrl, ossUrl: task.providerResultUrl || "", provider: task.provider }] : [])
  ]);
}

function renderUserImages() {
  const items = [
    ...userImageItems()
  ];
  viewRoot.innerHTML = `
    ${pageHead("用户图片", "查看小程序用户上传图、生成结果图以及对应 URL")}
    <section class="panel">${assetGrid(filterAssetsByGlobal(items))}</section>
  `;
}

function taskTable(items = data.tasks) {
  if (!items.length) return `<p class="muted">暂无任务。</p>`;
  return `
    <table class="task-table">
      <thead><tr><th>任务 ID</th><th>用户</th><th>模式</th><th>状态</th><th>调用引擎</th><th>模型</th><th>结果</th><th>创建时间</th><th>操作</th></tr></thead>
      <tbody>${items.map((task) => `
        <tr>
          <td><code>${task.id}</code></td>
          <td>
            <div class="user-cell small">
              ${imageOrMissing(displayUserAvatar(task), displayUserName(task))}
              <div><strong>${displayUserName(task)}</strong><span>${task.userId || "legacy"}</span></div>
            </div>
          </td>
          <td>${task.mode}</td>
          <td>${statusLabel(task.status)}</td>
          <td><span class="engine-pill ${task.provider || "mock"}">${providerName(task.provider)}</span></td>
          <td><code>${taskModel(task)}</code><span class="muted block">${taskSize(task)}</span></td>
          <td>${task.resultUrl ? `<a class="inline-link" href="${task.resultUrl}" target="_blank">查看结果</a>` : task.errorMessage ? `<span class="error">失败</span>` : "-"}</td>
          <td>${task.createdAt}</td>
          <td>
            <div class="row-actions compact-actions">
              <button class="primary" data-detail="${task.id}">详情</button>
              <button class="ghost danger" data-delete-task="${task.id}">删除</button>
            </div>
          </td>
        </tr>
      `).join("")}</tbody>
    </table>
  `;
}

function renderTasks() {
  const tasks = filterTasksByGlobal(data.tasks);
  const imageProvider = data.modelConfig?.activeProvider || "-";
  const imageModel = imageProvider === "doubao" ? data.modelConfig?.providers?.doubao?.model : data.modelConfig?.providers?.dashscope?.model;
  const videoProvider = data.videoConfig?.activeProvider || "-";
  const videoModel = videoProvider === "doubao" ? data.modelConfig?.providers?.doubao?.videoModel : data.videoConfig?.model;
  viewRoot.innerHTML = `
    ${pageHead("AI生成任务", "查看小程序用户调用记录、实际引擎、模型和结果回写")}
    <div class="cards">
      <div class="metric"><span>当前图生图引擎</span><strong>${providerName(imageProvider)}</strong><em>${imageModel || "-"}</em></div>
      <div class="metric"><span>当前图生视频引擎</span><strong>${providerName(videoProvider)}</strong><em>${videoModel || "-"}</em></div>
      <div class="metric"><span>历史调用</span><strong>${tasks.length}</strong><em>图片生成任务</em></div>
      <div class="metric"><span>成功结果</span><strong>${tasks.filter((x) => x.status === "success").length}</strong><em>已回写 OSS/本地</em></div>
    </div>
    <section class="panel">${taskTable(tasks)}</section>
  `;
}

function renderTaskDetail(task) {
  data.activeTask = task;
  viewRoot.innerHTML = `
    ${pageHead("任务详情", `${task.id} · ${task.mode}`, `<button class="primary" data-nav="生成任务">返回任务</button>`)}
    <div class="detail-layout">
      <section class="panel">
        <h2>图片链路</h2>
        <div class="image-row chain-row">
          <figure class="chain-card">
            <figcaption>人物图</figcaption>
            ${imageOrMissing(task.personUrl, "人物图")}
          </figure>
          <figure class="chain-card">
            <figcaption>服装图</figcaption>
            ${imageOrMissing(task.garmentUrl, "服装图")}
          </figure>
          <figure class="chain-card">
            <figcaption>生成结果</figcaption>
            ${imageOrMissing(task.resultUrl, "结果图")}
          </figure>
        </div>
      </section>
      <section class="panel">
        <h2>任务信息</h2>
        <div class="info-grid">
          <span>用户</span><strong>${displayUserName(task)}</strong>
          <span>状态</span><strong>${task.status}</strong>
          <span>调用引擎</span><strong>${providerName(task.provider)}</strong>
          <span>模型</span><strong>${taskModel(task)}</strong>
          <span>尺寸/规格</span><strong>${taskSize(task)}</strong>
          <span>供应商任务 ID</span><strong>${task.providerTaskId || "-"}</strong>
          <span>创建时间</span><strong>${task.createdAt || "-"}</strong>
          <span>完成时间</span><strong>${task.finishedAt || "-"}</strong>
        </div>
        <h2>调用记录</h2>
        <p class="url-line">结果 URL：${task.resultUrl || "-"}</p>
        <p class="url-line">供应商 URL：${shortUrl(task.providerResultUrl)}</p>
        <h2>提示词</h2>
        <p class="url-line">${task.actualPrompt || task.prompt}</p>
        ${task.errorMessage ? `<p class="error">${task.errorMessage}</p>` : ""}
        <button class="primary full" data-video-source="${task.id}">用结果图生成视频</button>
      </section>
    </div>
  `;
}

function renderResults() {
  const results = filterTasksByGlobal(data.tasks.filter((task) => task.status === "success"), "result");
  viewRoot.innerHTML = `
    ${pageHead("AI结果图库", "查看所有生成成功的图片结果，可继续生成展示视频")}
    <section class="panel">${assetGrid(results.map((task) => ({
      id: task.id,
      name: `${task.mode} · ${task.id}`,
      type: "结果图",
      color: task.provider || "模型",
      style: displayUserName(task),
      status: "上架",
      url: task.resultUrl || task.personUrl
    })))}</section>
  `;
}

function renderVideos() {
  const videos = filterVideosByGlobal();
  viewRoot.innerHTML = `
    ${pageHead("AI视频任务", "用图生视频模型把小程序结果图生成展示视频", `<button class="primary" data-video-source="${data.tasks.find((task) => task.status === "success")?.id || ""}">用最新结果生成视频</button>`)}
    <section class="panel">
      <table>
        <thead><tr><th>视频 ID</th><th>来源任务</th><th>状态</th><th>进度</th><th>调用引擎</th><th>模型</th><th>视频</th><th>创建时间</th><th>操作</th></tr></thead>
        <tbody>${videos.map((video) => `
          <tr>
            <td>${video.id}</td><td>${video.sourceTaskId || "-"}</td><td>${statusLabel(video.status)}</td><td>${video.progress}%</td>
            <td><span class="engine-pill ${video.provider || "mock"}">${providerName(video.provider)}</span></td>
            <td><code>${video.modelName || video.providerTaskPayload?.model || "-"}</code></td>
            <td>${video.videoUrl ? `<a class="inline-link" href="${video.videoUrl}" target="_blank">打开视频</a>` : video.errorMessage ? `<span class="error">失败</span>` : "-"}</td>
            <td>${video.createdAt}</td>
            <td>
              <div class="row-actions compact-actions">
                <button class="primary" data-video-detail="${video.id}">查看</button>
                <button class="ghost danger" data-delete-video="${video.id}">删除</button>
              </div>
            </td>
          </tr>
        `).join("")}</tbody>
      </table>
    </section>
    <section class="panel">
      <h2>视频预览</h2>
      ${renderVideoPreview(data.activeVideoTask || data.videos[0])}
    </section>
  `;
}

function renderVideoPreview(video) {
  if (!video) return `<p class="muted">暂无视频任务。先到结果图库或任务详情选择一张结果图生成视频。</p>`;
  if (video.videoUrl) {
    return `<video class="admin-video" src="${video.videoUrl}" poster="${mediaUrl(video.posterUrl)}" controls></video>
      <div class="row-actions"><button class="ghost" data-copy-url="${video.videoUrl}">复制视频 URL</button><a class="primary link-button" href="${video.videoUrl}" target="_blank">打开视频</a><a class="ghost link-button" href="${video.videoUrl}" download>保存视频</a></div>`;
  }
  return `
    <div class="admin-video image-video-preview ${video.status === "success" ? "animated" : ""}">
      ${imageOrMissing(video.posterUrl, "视频封面")}
      <span>${video.status} · ${video.progress}% ${video.errorMessage ? "· " + video.errorMessage : ""}</span>
    </div>
    <div class="row-actions"><button class="primary" data-video-refresh="${video.id}">刷新任务</button></div>
  `;
}

function renderVideoDetail(video) {
  data.activeVideoTask = video;
  viewRoot.innerHTML = `
    ${pageHead("视频详情", video.id, `<button class="primary" data-nav="视频任务">返回视频任务</button>`)}
    <div class="detail-layout">
      <section class="panel">
        <h2>展示视频</h2>
        ${renderVideoPreview(video)}
      </section>
      <section class="panel">
        <h2>视频信息</h2>
        <div class="info-grid">
          <span>来源任务</span><strong>${video.sourceTaskId || "-"}</strong>
          <span>状态</span><strong>${video.status}</strong>
          <span>进度</span><strong>${video.progress}%</strong>
          <span>调用引擎</span><strong>${providerName(video.provider)}</strong>
          <span>模型</span><strong>${video.modelName || video.providerTaskPayload?.model || "-"}</strong>
          <span>供应商任务 ID</span><strong>${video.providerTaskId || "-"}</strong>
          <span>创建时间</span><strong>${video.createdAt || "-"}</strong>
          <span>完成时间</span><strong>${video.finishedAt || "-"}</strong>
        </div>
        <p class="url-line">${video.videoUrl || video.providerVideoUrl || "暂无视频 URL"}</p>
        ${video.errorMessage ? `<p class="error">${video.errorMessage}</p>` : ""}
      </section>
    </div>
  `;
}

function renderSettings() {
  const storage = data.storageConfig || {};
  const video = data.videoConfig || {};
  const oss = storage.oss || {};
  viewRoot.innerHTML = `
    ${pageHead("OSS与系统设置", "配置 OSS、视频模型、端口和上线参数", `<button class="primary" id="saveStorageConfig">保存存储</button><button class="primary" id="saveVideoConfig">保存视频</button>`)}
    <section class="panel">
      <h2>图片与视频存储</h2>
      <p>当前存储：<strong>${storage.active || "local"}</strong></p>
      <p>OSS 状态：${oss.enabled ? "已启用" : "未启用"} · ${oss.bucket || "未配置 bucket"} · ${oss.hasAccessKeyId ? `AK ${oss.accessKeyIdPreview}` : "未保存 AK"}</p>
      <div class="form-grid">
        <label><span>存储模式</span><select id="storageActive"><option value="local" ${storage.active === "local" ? "selected" : ""}>本地 public</option><option value="oss" ${storage.active === "oss" ? "selected" : ""}>阿里云 OSS</option></select></label>
        <label><span>启用 OSS</span><select id="ossEnabled"><option value="false" ${!oss.enabled ? "selected" : ""}>否</option><option value="true" ${oss.enabled ? "selected" : ""}>是</option></select></label>
        <label><span>Bucket</span><input id="ossBucket" value="${oss.bucket || ""}"></label>
        <label><span>Region</span><input id="ossRegion" value="${oss.region || ""}"></label>
        <label><span>Endpoint</span><input id="ossEndpoint" value="${oss.endpoint || ""}"></label>
        <label><span>公网访问域名</span><input id="ossPublicBaseUrl" value="${oss.publicBaseUrl || ""}"></label>
        <label><span>AccessKey ID</span><input id="ossAccessKeyId" type="password" placeholder="${oss.hasAccessKeyId ? `已保存：${oss.accessKeyIdPreview}` : "仅保存到本地后端"}"></label>
        <label><span>AccessKey Secret</span><input id="ossAccessKeySecret" type="password" placeholder="${oss.hasAccessKeySecret ? "已保存，不展示" : "仅保存到本地后端"}"></label>
      </div>
    </section>
    <section class="panel">
      <h2>视频生成</h2>
      <p>当前视频模型：<strong>${video.model || "doubao-seedance-1-0-pro-fast-251015"}</strong></p>
      <div class="form-grid">
        <label><span>视频供应商</span><select id="videoProvider"><option value="dashscope" ${video.activeProvider === "dashscope" ? "selected" : ""}>阿里 DashScope 图生视频</option><option value="doubao" ${(video.activeProvider || "doubao") === "doubao" ? "selected" : ""}>火山引擎 / 豆包视频</option></select></label>
        <label><span>视频模型</span><input id="videoModel" value="${video.model || "doubao-seedance-1-0-pro-fast-251015"}"></label>
        <label><span>区域</span><input id="videoRegion" value="${video.region || "cn-beijing"}"></label>
        <label><span>分辨率</span><select id="videoResolution"><option value="720P" ${(video.resolution || "720P").toUpperCase() === "720P" ? "selected" : ""}>720P</option></select></label>
        <label><span>时长秒数</span><select id="videoDuration"><option value="5" selected>5 秒</option></select></label>
        <label><span>最长等待秒数</span><input id="videoWait" value="${video.maxWaitSeconds || 600}"></label>
      </div>
    </section>
  `;
}

function renderShopProducts() {
  const styles = data.styles || [];
  const fabrics = data.fabrics || [];
  
  viewRoot.innerHTML = `
    ${pageHead("电商商品", "管理电商定制款式、基础售价，以及可选的 17 种潘通面料与溢价")}
    
    <div class="grid2">
      <!-- Styles Management -->
      <section class="panel">
        <div class="page-head" style="margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
          <h2>款式列表 (${styles.length})</h2>
        </div>
        
        <table class="task-table">
          <thead>
            <tr>
              <th>缩略图</th>
              <th>款式ID</th>
              <th>款式名称</th>
              <th>基础定制价</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${styles.map(style => `
              <tr>
                <td><img src="${style.image}" style="width: 42px; height: 42px; object-fit: cover; border-radius: 6px;"></td>
                <td><code>${style.id}</code></td>
                <td><strong>${style.name}</strong></td>
                <td><span class="font-mono">¥${style.basePrice}</span></td>
                <td>
                  <div class="row-actions compact-actions">
                    <button class="ghost" data-edit-style="${style.id}">编辑</button>
                    <button class="ghost danger" data-delete-style="${style.id}">删除</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        
        <div style="margin-top: 24px; border-top: 1px solid var(--line); padding-top: 16px;">
          <h3>新增款式</h3>
          <div class="form-grid" style="margin-top: 10px;">
            <label><span>款式 ID *</span><input id="newStyleId" placeholder="例如: tx"></label>
            <label><span>名称 *</span><input id="newStyleName" placeholder="例如: 极简T恤"></label>
            <label><span>基础定价 *</span><input id="newStylePrice" type="number" placeholder="199"></label>
            <label><span>图标路径</span><input id="newStyleImage" value=""></label>
            <button class="primary" id="saveNewStyleBtn">提交保存</button>
          </div>
        </div>
      </section>

      <!-- Fabrics Management -->
      <section class="panel">
        <div class="page-head" style="margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
          <h2>面料列表 (${fabrics.length})</h2>
        </div>
        
        <div style="max-height: 480px; overflow-y: auto;">
          <table class="task-table">
            <thead>
              <tr>
                <th>颜色</th>
                <th>面料ID</th>
                <th>面料名称</th>
                <th>潘通色号</th>
                <th>溢价/加价</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${fabrics.map(fabric => `
                <tr>
                  <td>
                    <div style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.1); background-color: ${fabric.hex};"></div>
                  </td>
                  <td><code>${fabric.id}</code></td>
                  <td><strong>${fabric.name}</strong><span class="muted block" style="font-size: 10px;">${fabric.composition}</span></td>
                  <td><code style="font-size: 10px;">${fabric.pantone.split(" ")[0]}</code></td>
                  <td><span class="font-mono">¥${fabric.priceMarkup}</span></td>
                  <td>
                    <div class="row-actions compact-actions">
                      <button class="ghost" data-edit-fabric="${fabric.id}">编辑</button>
                      <button class="ghost danger" data-delete-fabric="${fabric.id}">删除</button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 24px; border-top: 1px solid var(--line); padding-top: 16px;">
          <h3>新增面料</h3>
          <div class="form-grid" style="margin-top: 10px;">
            <label><span>面料 ID *</span><input id="newFabricId" placeholder="例如: fabric18"></label>
            <label><span>面料名称 *</span><input id="newFabricName" placeholder="例如: 精梳丝光棉"></label>
            <label><span>成分</span><input id="newFabricComp" placeholder="100% 埃及棉"></label>
            <label><span>克重</span><input id="newFabricWeight" placeholder="200克/平方米"></label>
            <label><span>门幅</span><input id="newFabricWidth" placeholder="150厘米"></label>
            <label><span>潘通色号</span><input id="newFabricPantone" placeholder="19-4052 TCX"></label>
            <label><span>加价溢价 *</span><input id="newFabricMarkup" type="number" placeholder="0"></label>
            <label><span>HEX 颜色码</span><input id="newFabricHex" type="color" value="#0F4C81"></label>
            <label><span>RGB 颜色码</span><input id="newFabricRgb" value="15, 76, 129" placeholder="15, 76, 129"></label>
            <button class="primary" id="saveNewFabricBtn">提交保存</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderShopOrders() {
  const orders = data.shopOrders || [];
  
  // Calculate stats
  const totalCount = orders.length;
  const pendingCount = orders.filter(o => o.status === "pending_payment").length;
  const paidCount = orders.filter(o => o.status === "paid" || o.status === "已支付").length;
  const shippedCount = orders.filter(o => o.status === "shipped" || o.status === "已发货").length;
  const completedCount = orders.filter(o => o.status === "completed" || o.status === "已完成").length;
  const totalAmount = orders.filter(o => o.status !== "pending_payment").reduce((sum, o) => sum + (Number(o.amount) || 0), 0);

  const statusMap = {
    "pending_payment": "待支付",
    "paid": "已支付 / 待发货",
    "shipped": "已发货",
    "completed": "已完成"
  };

  viewRoot.innerHTML = `
    ${pageHead("电商订单", "管理电商定制量体裁剪订单，包含订单状态变更与发货处理")}
    
    <div class="cards">
      <div class="metric"><span>全部订单</span><strong>${totalCount}</strong><em>笔</em></div>
      <div class="metric"><span>待支付订单</span><strong>${pendingCount}</strong><em>笔</em></div>
      <div class="metric"><span>已付款/待发</span><strong>${paidCount}</strong><em>笔</em></div>
      <div class="metric"><span>实收金额</span><strong>¥${totalAmount}</strong><em>已支付总额</em></div>
    </div>

    <section class="panel">
      <div class="page-head" style="margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
        <h2>定制订单列表 (${orders.length})</h2>
      </div>
      
      <table class="task-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>下单用户</th>
            <th>收货信息</th>
            <th>定制详情</th>
            <th>数量 & 金额</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(order => {
            const style = data.styles?.find(s => s.id === order.styleId) || { name: order.styleId };
            const fabric = data.fabrics?.find(f => f.id === order.fabricId) || { name: order.fabricId, hex: "#ccc" };
            const user = data.users?.find(u => u.id === order.userId);
            const userAvatar = user?.avatarUrl || user?.avatar || "";
            const userNick = user?.nickName || user?.name || "微信用户";
            
            let statusLabelClass = "";
            if (order.status === "pending_payment") statusLabelClass = "failed";
            else if (order.status === "paid") statusLabelClass = "success";
            else if (order.status === "shipped") statusLabelClass = "";
            else if (order.status === "completed") statusLabelClass = "success";
            
            let actionButtons = "";
            if (order.status === "pending_payment") {
              actionButtons = `<button class="primary" data-pay-order="${order.id}">确认收款</button>`;
            } else if (order.status === "paid") {
              actionButtons = `<button class="primary" style="background-color: var(--green);" data-ship-order="${order.id}">确认发货</button>`;
            } else if (order.status === "shipped") {
              actionButtons = `<button class="primary" style="background-color: #7c2d12;" data-complete-order="${order.id}">完成订单</button>`;
            }

            return `
              <tr>
                <td><code>${order.id}</code></td>
                <td>
                  <div class="user-cell small" style="display: flex; align-items: center; gap: 8px;">
                    ${imageOrMissing(userAvatar, userNick)}
                    <div>
                      <strong>${userNick}</strong>
                      <span class="block muted" style="font-size: 10px;">${order.userId || "u001"}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>${order.receiver?.fullName || order.receiver?.name || "未填写"}</strong>
                  <span class="block muted" style="font-size: 11px;">${order.receiver?.phone || "无电话"}</span>
                  <span class="block muted" style="font-size: 10px; max-width: 220px; white-space: normal; line-height: 1.2;">${order.receiver?.address || "无地址"}</span>
                </td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.1); background-color: ${fabric.hex || '#ccc'}; shrink: 0;" title="${fabric.name}"></div>
                    <div>
                      <strong>${style.name || order.styleId}</strong>
                      <span class="block muted" style="font-size: 10px;">面料: ${fabric.name || order.fabricId} · 尺码: <span style="font-weight: bold;">${order.size}</span></span>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>${order.quantity} 件</strong>
                  <span class="block font-mono text-primary" style="font-size: 11px;">¥${order.amount}</span>
                </td>
                <td>
                  <span class="status ${statusLabelClass}">${statusMap[order.status] || order.status}</span>
                </td>
                <td><span style="font-size: 11px;">${order.createdAt || "-"}</span></td>
                <td>
                  <div class="row-actions compact-actions" style="flex-direction: column; gap: 4px; align-items: flex-start;">
                    ${actionButtons}
                    <div class="row-actions compact-actions" style="margin-top: 4px;">
                      <button class="ghost" data-edit-order-address="${order.id}">改地址</button>
                      <button class="ghost danger" data-delete-order="${order.id}">删除</button>
                    </div>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderShopReviews() {
  const reviews = data.shopReviews || [];
  
  viewRoot.innerHTML = `
    ${pageHead("电商评价", "审核消费者填写的成衣穿着定制体验，删除不良发言")}
    
    <section class="panel">
      <div class="page-head" style="margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
        <h2>定制客户评价列表 (${reviews.length})</h2>
      </div>
      
      <table class="task-table">
        <thead>
          <tr>
            <th>用户/买家</th>
            <th>评分</th>
            <th style="width: 50%;">评价内容</th>
            <th>定制买家</th>
            <th>日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${reviews.map(review => {
            const stars = Array.from({ length: 5 }, (_, i) => 
              `<span style="color: ${i < review.rating ? '#fbbf24' : '#d1d5db'}; font-size: 16px;">★</span>`
            ).join("");
            
            return `
              <tr>
                <td>
                  <strong>${review.name}</strong>
                  <span class="block muted" style="font-size: 10px;">${review.role || "定制买家"}</span>
                </td>
                <td>
                  <div style="display: flex;">${stars}</div>
                  <span class="muted" style="font-size: 10px;">${review.rating} 星</span>
                </td>
                <td style="white-space: normal; word-break: break-all; line-height: 1.4; font-size: 13px;">
                  ${review.comment}
                </td>
                <td>
                  ${review.verified ? `<span class="status success" style="font-size: 10px; padding: 2px 6px;">已购成衣买家</span>` : `<span class="status" style="font-size: 10px; padding: 2px 6px;">游客</span>`}
                </td>
                <td><span style="font-size: 11px;">${review.date}</span></td>
                <td>
                  <button class="ghost danger" data-delete-review="${review.id}">下架删除</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function savedKeyText(provider) {
  return provider?.hasKey ? `已保存：${provider.keyPreview}` : "留空则保持原 key";
}

function enabledSelect(id, enabled) {
  return `<select id="${id}"><option value="true" ${enabled ? "selected" : ""}>启用</option><option value="false" ${enabled ? "" : "selected"}>停用</option></select>`;
}

function providerSummary(name, provider, active, status = "") {
  const enabled = provider?.enabled !== false;
  const keyText = status === "无需 Key" ? "无需 Key" : provider?.hasKey ? "Key 已保存" : "未保存 Key";
  return `
    <div class="provider-card ${active ? "active" : ""}">
      <strong>${name}</strong>
      <span>${enabled ? "已启用" : "已停用"} · ${keyText}${status && status !== "无需 Key" ? ` · ${status}` : ""}</span>
    </div>
  `;
}

function renderModelConfig() {
  const cfg = data.modelConfig || {};
  const video = data.videoConfig || {};
  const dashscope = cfg.providers?.dashscope || {};
  const doubao = cfg.providers?.doubao || {};
  const active = cfg.activeProvider || "dashscope";
  const activeVideo = video.activeProvider || "doubao";
  viewRoot.innerHTML = `
    ${pageHead("AI模型配置", "管理小程序 AI 生成使用的阿里与火山图生图、图生视频能力", `<button class="primary" id="saveModelConfig">保存配置</button>`)}
    <section class="panel">
      <h2>能力通道</h2>
      <div class="form-grid">
        <label><span>默认图生图 / 换装</span><select id="activeProvider">
            <option value="dashscope" ${active === "dashscope" ? "selected" : ""}>阿里 Wan2.5 图生图</option>
            <option value="doubao" ${active === "doubao" ? "selected" : ""}>火山 Seedream 4.5 图生图</option>
          </select></label>
        <label><span>默认图生视频</span><select id="activeVideoProvider">
            <option value="dashscope" ${activeVideo === "dashscope" ? "selected" : ""}>阿里 Wan 图生视频</option>
            <option value="doubao" ${activeVideo === "doubao" ? "selected" : ""}>火山 Seedance 1.0 pro fast</option>
          </select></label>
        <label><span>Key 保存位置</span><input value="仅保存在后端 runtime-config.json，不在前端返回明文" disabled></label>
      </div>
      <div class="provider-list model-providers">
        ${providerSummary("阿里图生图 Wan2.5", dashscope, active === "dashscope", dashscope.model || "wan2.5-i2i-preview")}
        ${providerSummary("阿里图生视频 Wan", dashscope, activeVideo === "dashscope", video.activeProvider === "dashscope" ? video.model : "wan2.7-i2v-2026-04-25")}
        ${providerSummary("火山图生图 Seedream 4.5", doubao, active === "doubao", doubao.model || "doubao-seedream-4-5-251128")}
        ${providerSummary("火山图生视频 Seedance", doubao, activeVideo === "doubao", `${doubao.videoModel || "doubao-seedance-1-0-pro-fast-251015"} · 720P/5秒`)}
      </div>
    </section>

    <section class="panel model-section">
      <h2>阿里 DashScope 图生图 / 图生视频</h2>
      <div class="form-grid">
        <label><span>状态</span>${enabledSelect("dashscopeEnabled", dashscope.enabled !== false)}</label>
        <label><span>区域</span><select id="dashscopeRegion"><option value="beijing" ${dashscope.region === "beijing" ? "selected" : ""}>北京</option><option value="singapore" ${dashscope.region === "singapore" ? "selected" : ""}>新加坡</option></select></label>
        <label><span>图生图模型</span><input id="dashscopeModel" value="${dashscope.model || "wan2.5-i2i-preview"}"></label>
        <label><span>图生视频模型</span><input id="dashscopeVideoModel" value="${video.activeProvider === "dashscope" ? (video.model || "wan2.7-i2v-2026-04-25") : "wan2.7-i2v-2026-04-25"}"></label>
        <label><span>输出尺寸</span><select id="dashscopeSize">${["auto", "1280*1280", "1024*1024", "800*1200", "1200*800", "720*1280", "1280*720"].map((x) => `<option value="${x}" ${dashscope.size === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label><span>提示词扩展</span><select id="dashscopePromptExtend"><option value="true" ${dashscope.promptExtend !== false ? "selected" : ""}>开启</option><option value="false" ${dashscope.promptExtend === false ? "selected" : ""}>关闭</option></select></label>
        <label><span>最大等待秒数</span><input id="dashscopeWait" value="${dashscope.maxWaitSeconds || 180}"></label>
        <label class="form-wide"><span>DashScope API Key</span><input id="dashscopeKey" type="password" placeholder="${savedKeyText(dashscope)}"></label>
      </div>
    </section>

    <section class="panel model-section">
      <h2>火山引擎 / 豆包图生图 / 图生视频</h2>
      <div class="form-grid">
        <label><span>状态</span>${enabledSelect("doubaoEnabled", Boolean(doubao.enabled))}</label>
        <label><span>区域</span><input id="doubaoRegion" value="${doubao.region || "cn-beijing"}"></label>
        <label><span>Base URL</span><input id="doubaoBaseUrl" value="${doubao.baseUrl || "https://ark.cn-beijing.volces.com/api/v3"}"></label>
        <label><span>图片 Endpoint</span><input id="doubaoEndpoint" value="${doubao.endpoint || "/images/generations"}"></label>
        <label><span>图生图模型</span><input id="doubaoModel" value="${doubao.model || "doubao-seedream-4-5-251128"}"></label>
        <label><span>图片尺寸</span><select id="doubaoSize">${["1440x2560", "2560x1440"].map((x) => `<option value="${x}" ${doubao.size === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label><span>视频模型</span><input id="doubaoVideoModel" value="${doubao.videoModel || "doubao-seedance-1-0-pro-fast-251015"}"></label>
        <label><span>3D 模型</span><input id="doubao3dModel" value="${doubao.threeDModel || "doubao-seed3d-1-0-250928"}"></label>
        <label><span>视频 Endpoint</span><input id="doubaoVideoEndpoint" value="${doubao.videoEndpoint || "/contents/generations/tasks"}"></label>
        <label><span>视频规格</span><input value="720p · 5 秒" disabled></label>
        <label><span>最大等待秒数</span><input id="doubaoWait" value="${doubao.maxWaitSeconds || 180}"></label>
        <label class="form-wide"><span>火山 API Key</span><input id="doubaoKey" type="password" placeholder="${savedKeyText(doubao)}"></label>
        <p class="form-wide muted">真实生成前，需要在火山方舟控制台开通当前图片模型和视频模型；Key 保存后这里只显示脱敏状态。</p>
      </div>
    </section>

  `;
}

function fabricImageSrc(base64, type = "png") {
  return base64 ? `data:image/${type};base64,${base64}` : "";
}

function dataUrlPayload(value = "") {
  return String(value).includes(",") ? String(value).split(",", 2)[1] : String(value);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

async function fabricLocalApi(path, options = {}) {
  const base = fabricTool.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || `本机面料服务 ${res.status}`);
  return body;
}

function renderFabricPaletteInputs() {
  const palette = fabricTool.palette.length === 6
    ? fabricTool.palette
    : [[32, 32, 32], [92, 92, 92], [165, 165, 165], [210, 210, 210], [120, 96, 72], [220, 204, 180]];
  return palette.map((rgb, index) => {
    const hex = `#${rgb.map((v) => Number(v || 0).toString(16).padStart(2, "0")).join("")}`;
    return `<label><span>色块 ${index + 1}</span><input class="fabric-color" data-color-index="${index}" type="color" value="${hex}"></label>`;
  }).join("");
}

function readFabricPalette() {
  return Array.from(document.querySelectorAll(".fabric-color")).map((input) => {
    const value = input.value.replace("#", "");
    return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  });
}

function renderFabricWorkbench() {
  const ready = fabricTool.connected;
  const sourceMode = fabricTool.useCustomBase ? "custom" : "preset";
  const referenceLabel = fabricTool.uploadedReferenceName || (fabricTool.selectedLandscape ? `内置参考：${fabricTool.selectedLandscape.replace(/\.\w+$/, "")}` : "尚未选择参考图");
  const sourceLabel = fabricTool.useCustomBase
    ? (fabricTool.customBaseName || "上传待处理图")
    : `${(fabricTool.selectedStyle || "款式").replace(/\.\w+$/, "")} / ${(fabricTool.selectedFabric || "面料").replace(/\.\w+$/, "")}`;
  viewRoot.innerHTML = `
    ${pageHead("面料工作台", "页面在管理端打开，推理跑管理员本机 127.0.0.1，结果再上传 OSS 入库", `
      <button class="ghost" data-nav="素材库">返回素材库</button>
      <button class="primary" id="connectFabricTool">连接本机服务</button>
    `)}
    <input id="fabricBaseInput" type="file" accept="image/*" hidden>
    <input id="fabricReferenceInput" type="file" accept="image/*" hidden>
    <section class="panel fabric-service-panel">
      <div class="fabric-service-grid">
        <label><span>本机服务地址</span><input id="fabricServiceUrl" value="${fabricTool.baseUrl}"></label>
        <div>
          <span class="status ${ready ? "success" : ""}">${ready ? "已连接" : "未连接"}</span>
          <p class="muted">建议本机服务固定运行在 <code>python server.py 5188</code>。网页只调用你自己电脑的 127.0.0.1，不吃服务器算力，结果再走 FabricMind 上传到 OSS。</p>
        </div>
      </div>
      <p class="muted">${fabricTool.message}</p>
    </section>

    <div class="fabric-workbench ${ready ? "" : "disabled"}">
      <section class="fabric-tool-strip">
        <div><span>当前素材</span><strong>${sourceLabel}</strong></div>
        <div><span>提色来源</span><strong>${referenceLabel}</strong></div>
        <div><span>入库方式</span><strong>生成后手动上传 OSS</strong></div>
      </section>

      <section class="panel">
        <h2>1. 选择待处理素材</h2>
        <div class="mode-tabs">
          <button class="${sourceMode === "preset" ? "active" : ""}" data-fabric-source-mode="preset">内置款式 + 面料</button>
          <button class="${sourceMode === "custom" ? "active" : ""}" data-fabric-source-mode="custom">上传本地图</button>
        </div>
        <div class="form-grid">
          <label><span>款式</span><select id="fabricToolStyle">${fabricTool.styles.map((name) => `<option value="${name}" ${name === fabricTool.selectedStyle ? "selected" : ""}>${name.replace(/\.\w+$/, "")}</option>`).join("")}</select></label>
          <label><span>面料</span><select id="fabricToolFabric">${fabricTool.fabrics.map((name) => `<option value="${name}" ${name === fabricTool.selectedFabric ? "selected" : ""}>${name.replace(/\.\w+$/, "")}</option>`).join("")}</select></label>
          <label><span>内置白底模板</span><select id="fabricToolTemplate">${fabricTool.templates.map((name) => `<option value="${name}" ${name === fabricTool.selectedTemplate ? "selected" : ""}>${name.replace(/\.\w+$/, "")}</option>`).join("")}</select></label>
          <div class="fabric-file-actions">
            <span>模板底图</span>
            <button class="ghost" id="useFabricTemplate" ${fabricTool.selectedTemplate ? "" : "disabled"}>使用模板</button>
          </div>
          <label><span>保护白色背景</span><select id="fabricPreserveWhite"><option value="true" ${fabricTool.preserveWhiteBackground ? "selected" : ""}>开启</option><option value="false" ${!fabricTool.preserveWhiteBackground ? "selected" : ""}>关闭</option></select></label>
          <div class="fabric-file-actions">
            <span>上传待处理图</span>
            <div class="row-actions">
              <button class="ghost" id="pickFabricBase">选择图片</button>
              <button class="ghost" id="clearFabricBase" ${fabricTool.customBase64 ? "" : "disabled"}>清除上传图</button>
            </div>
          </div>
        </div>
        <p class="muted">内置模式使用老师预组合模板；上传本地图适合试白底模板、服装图或你临时准备的素材图。它做的是重着色，不是完整语义换布料。</p>
      </section>

      <section class="panel">
        <h2>2. 选择配色来源</h2>
        <div class="form-grid">
          <label><span>内置参考图</span><select id="fabricToolLandscape">${fabricTool.landscapes.map((name) => `<option value="${name}" ${name === fabricTool.selectedLandscape ? "selected" : ""}>${name.replace(/\.\w+$/, "")}</option>`).join("")}</select></label>
          <div class="fabric-file-actions">
            <span>上传参考图提色</span>
            <button class="ghost" id="pickFabricReference">选择参考图</button>
          </div>
          <button class="ghost form-button" id="extractFabricPalette">提取内置参考色板</button>
        </div>
        <div class="fabric-reference-row">
          <div class="fabric-thumb-card">
            <span>${referenceLabel}</span>
            <img src="${fabricImageSrc(fabricTool.referenceBase64)}" alt="提色参考图">
          </div>
          <div class="fabric-palette-card">
            <span>6 色色板，可手动微调</span>
            <div class="fabric-palette-grid">${renderFabricPaletteInputs()}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>3. 本机生成并入库</h2>
        <div class="fabric-preview-grid">
          <div><span>${fabricTool.useCustomBase ? (fabricTool.customBaseName || "上传待处理图") : "原始组合"}</span><img src="${fabricImageSrc(fabricTool.originalBase64)}" alt="原始组合"></div>
          <div><span>重着色结果</span><img src="${fabricImageSrc(fabricTool.resultBase64)}" alt="重着色结果"></div>
        </div>
        <div class="row-actions">
          <button class="primary" id="fabricRecolorBtn" ${ready ? "" : "disabled"}>本机生成</button>
          <button class="ghost" id="fabricUploadResultBtn" ${fabricTool.resultBase64 ? "" : "disabled"}>上传到 OSS 素材库</button>
        </div>
      </section>
    </div>
  `;
}

async function connectFabricTool() {
  fabricTool.baseUrl = document.querySelector("#fabricServiceUrl")?.value?.trim() || fabricTool.baseUrl;
  localStorage.setItem("fabricLocalServiceUrl", fabricTool.baseUrl);
  fabricTool.message = "正在连接本机服务...";
  renderFabricWorkbench();
  const [styles, fabrics, templates, landscapes] = await Promise.all([
    fabricLocalApi("/api/styles"),
    fabricLocalApi("/api/fabrics"),
    fabricLocalApi("/api/templates"),
    fabricLocalApi("/api/landscapes")
  ]);
  fabricTool.styles = styles;
  fabricTool.fabrics = fabrics;
  fabricTool.templates = templates;
  fabricTool.landscapes = landscapes;
  fabricTool.selectedStyle = fabricTool.selectedStyle || styles[0] || "";
  fabricTool.selectedFabric = fabricTool.selectedFabric || fabrics[0] || "";
  fabricTool.selectedTemplate = fabricTool.selectedTemplate || templates[0] || "";
  fabricTool.selectedLandscape = fabricTool.selectedLandscape || landscapes[0] || "";
  fabricTool.connected = true;
  fabricTool.message = `本机服务已连接：${styles.length} 个款式、${fabrics.length} 个面料、${templates.length} 个白底模板、${landscapes.length} 张提色图`;
  await Promise.all([
    refreshFabricToolOriginal({ render: false }),
    refreshFabricToolReference({ render: false })
  ]);
  await extractFabricPalette();
}

async function refreshFabricToolOriginal(options = {}) {
  if (!fabricTool.selectedStyle || !fabricTool.selectedFabric) return;
  if (fabricTool.useCustomBase && fabricTool.customBase64) {
    fabricTool.originalBase64 = fabricTool.customBase64;
    if (options.render !== false && current === "面料工作台") renderFabricWorkbench();
    return;
  }
  const data = await fabricLocalApi(`/api/kuanshi_image/${encodeURIComponent(fabricTool.selectedStyle)}/${encodeURIComponent(fabricTool.selectedFabric)}`);
  fabricTool.originalBase64 = data.image || "";
  if (options.render !== false && current === "面料工作台") renderFabricWorkbench();
}

async function refreshFabricToolReference(options = {}) {
  if (!fabricTool.selectedLandscape) return;
  const data = await fabricLocalApi(`/api/landscape_image/${encodeURIComponent(fabricTool.selectedLandscape)}`);
  fabricTool.referenceBase64 = data.image || "";
  if (options.render !== false && current === "面料工作台") renderFabricWorkbench();
}

async function extractFabricPalette() {
  if (!fabricTool.selectedLandscape) return;
  fabricTool.uploadedReferenceName = "";
  await refreshFabricToolReference({ render: false });
  const body = await fabricLocalApi("/api/extract_landscape_palette", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ landscape_name: fabricTool.selectedLandscape })
  });
  fabricTool.palette = body.palette || [];
  fabricTool.message = "色板已提取，可继续手动微调";
  if (current === "面料工作台") renderFabricWorkbench();
}

async function extractUploadedReference(file) {
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  const body = await fabricLocalApi("/api/extract_palette_upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_base64: dataUrlPayload(dataUrl) })
  });
  fabricTool.palette = body.palette || [];
  fabricTool.referenceBase64 = body.image || dataUrlPayload(dataUrl);
  fabricTool.uploadedReferenceName = file.name;
  fabricTool.message = `已从 ${file.name} 提取色板`;
  fabricTool.resultBase64 = "";
  renderFabricWorkbench();
}

async function loadCustomFabricBase(file) {
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  fabricTool.customBase64 = dataUrlPayload(dataUrl);
  fabricTool.customBaseName = file.name;
  fabricTool.useCustomBase = true;
  fabricTool.originalBase64 = fabricTool.customBase64;
  fabricTool.resultBase64 = "";
  fabricTool.message = `已载入待处理图：${file.name}`;
  renderFabricWorkbench();
}

async function loadTemplateFabricBase() {
  if (!fabricTool.selectedTemplate) throw new Error("没有可用模板");
  const data = await fabricLocalApi(`/api/template_image/${encodeURIComponent(fabricTool.selectedTemplate)}`);
  fabricTool.customBase64 = data.image || "";
  fabricTool.customBaseName = `模板：${fabricTool.selectedTemplate.replace(/\.\w+$/, "")}`;
  fabricTool.useCustomBase = true;
  fabricTool.originalBase64 = fabricTool.customBase64;
  fabricTool.resultBase64 = "";
  fabricTool.message = `已载入白底模板：${fabricTool.selectedTemplate}`;
  renderFabricWorkbench();
}

async function setFabricSourceMode(mode) {
  fabricTool.useCustomBase = mode === "custom";
  fabricTool.resultBase64 = "";
  if (!fabricTool.useCustomBase) {
    await refreshFabricToolOriginal({ render: false });
  } else if (fabricTool.customBase64) {
    fabricTool.originalBase64 = fabricTool.customBase64;
  }
  renderFabricWorkbench();
}

function clearCustomFabricBase() {
  fabricTool.customBase64 = "";
  fabricTool.customBaseName = "";
  fabricTool.useCustomBase = false;
  fabricTool.resultBase64 = "";
  refreshFabricToolOriginal().catch((error) => toast(error.message || "预览加载失败"));
}

async function recolorFabricTool() {
  fabricTool.palette = readFabricPalette();
  if (fabricTool.palette.length !== 6) throw new Error("请先提取或补齐 6 个色块");
  if (fabricTool.useCustomBase && !fabricTool.customBase64) throw new Error("请先上传待处理图");
  fabricTool.message = "正在调用本机模型生成...";
  renderFabricWorkbench();
  const payload = fabricTool.useCustomBase
    ? {
        image_base64: fabricTool.customBase64,
        palette_rgb: fabricTool.palette,
        preserve_white_background: fabricTool.preserveWhiteBackground
      }
    : {
        style_name: fabricTool.selectedStyle,
        fabric_name: fabricTool.selectedFabric,
        palette_rgb: fabricTool.palette
      };
  const body = await fabricLocalApi(fabricTool.useCustomBase ? "/api/recolor_uploaded" : "/api/recolor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  fabricTool.resultBase64 = body.recolor_image || "";
  fabricTool.message = "本机生成完成，可以上传到 OSS 素材库";
  renderFabricWorkbench();
}

async function uploadFabricToolResult() {
  if (!fabricTool.resultBase64) return toast("还没有生成结果");
  const name = prompt("素材名称", `面料重着色-${Date.now()}`) || `面料重着色-${Date.now()}`;
  const uploaded = await api("/api/uploads", {
    method: "POST",
    body: JSON.stringify({
      filename: `${name}.png`,
      contentType: "image/png",
      base64: fabricTool.resultBase64
    })
  });
  await api("/api/admin/assets", {
    method: "POST",
    body: JSON.stringify({
      name,
      type: "面料",
      color: fabricTool.uploadedReferenceName ? "上传参考图提色" : "重着色",
      style: fabricTool.useCustomBase ? "上传底图重着色" : "本机面料工作台",
      url: uploaded.url,
      ossUrl: uploaded.ossUrl || uploaded.url
    })
  });
  toast("已上传到 OSS 素材库");
  await refreshAll();
  current = "素材库";
  renderAssets();
}

function render() {
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.nav === current));
  if (current === "概览") renderOverview();
  if (current === "素材库") renderAssets();
  if (current === "面料工作台") renderFabricWorkbench();
  if (current === "商品管理") renderShopProducts();
  if (current === "订单管理") renderShopOrders();
  if (current === "评价管理") renderShopReviews();
  if (current === "用户管理") renderUsers();
  if (current === "用户图片") renderUserImages();
  if (current === "生成任务") renderTasks();
  if (current === "结果图库") renderResults();
  if (current === "视频任务") renderVideos();
  if (current === "模型配置") renderModelConfig();
  if (current === "设置") renderSettings();
}

async function refreshAll() {
  data.assets = (await api("/api/admin/assets")).items;
  data.tasks = (await api("/api/admin/tasks")).items;
  data.users = (await api("/api/admin/users")).items;
  data.videos = (await api("/api/admin/videos")).items;
  data.shopOrders = (await api("/api/admin/shop/orders")).items;
  data.shopReviews = (await api("/api/admin/shop/reviews")).items;
  data.styles = await api("/api/shop/styles");
  data.fabrics = await api("/api/shop/fabrics");
}

async function refreshAndRender(renderFn = render) {
  if (refreshing) return;
  setRefreshing(true);
  try {
    await refreshAll();
    renderFn();
  } catch (error) {
    toast(error.message || "刷新失败");
  } finally {
    setRefreshing(false);
  }
}

async function renderFreshDetail(kind, id) {
  await refreshAndRender(() => {
    if (kind === "user") {
      const user = data.users.find((item) => item.id === id);
      if (user) return renderUserDetail(user);
    }
    if (kind === "task") {
      const task = data.tasks.find((item) => item.id === id);
      if (task) return renderTaskDetail(task);
    }
    if (kind === "video") {
      const video = data.videos.find((item) => item.id === id);
      if (video) return renderVideoDetail(video);
    }
    if (kind === "asset") {
      const asset = data.assets.find((item) => item.id === id) || userImageItems().find((item) => item.id === id) || data.tasks.find((item) => item.id === id);
      if (asset?.resultUrl) return renderTaskDetail(asset);
      if (asset) return renderAssetDetail(asset);
    }
    render();
  });
}

async function refreshModelTask(id) {
  const task = await api(`/api/tasks/${id}`);
  data.activeModelTask = task;
  if (current === "模型配置") renderModelConfig();
  if (!["success", "failed"].includes(task.status)) {
    setTimeout(() => refreshModelTask(id), 1600);
  } else {
    await refreshAll();
  }
}

async function refreshVideoTask(id) {
  const video = await api(`/api/videos/${id}`);
  data.activeVideoTask = video;
  if (current === "视频任务") renderVideos();
  if (!["success", "failed"].includes(video.status)) {
    setTimeout(() => refreshVideoTask(id), 3000);
  } else {
    await refreshAll();
    if (current === "视频任务") renderVideos();
  }
}

async function uploadAssetFile(file) {
  const type = prompt("素材类型：上衣 / 下装 / 整套 / 人物", "上衣") || "上衣";
  const name = prompt("素材名称", file.name.replace(/\.[^.]+$/, "")) || file.name.replace(/\.[^.]+$/, "") || "上传素材";
  const form = new FormData();
  form.append("file", file);
  const uploaded = await api("/api/uploads", { method: "POST", body: form });
  const asset = await api("/api/admin/assets", {
    method: "POST",
    body: JSON.stringify({
      name,
      type,
      color: "未标注",
      style: "管理员上传",
      url: uploaded.url,
      ossUrl: uploaded.ossUrl || uploaded.url
    })
  });
  data.assets.unshift(asset.asset);
  toast("素材已上传到 OSS");
  await refreshAndRender(renderAssets);
}

document.addEventListener("click", async (event) => {
  const el = event.target;

  // --- highest-priority: specific buttons and image preview ---
  if (el.tagName === "IMG") {
    event.stopPropagation();
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<img src="${el.src}">`;
    box.onclick = () => box.remove();
    return document.body.appendChild(box);
  }

  const copyUrl = el.closest("[data-copy-url]")?.dataset.copyUrl;
  if (copyUrl) { event.stopPropagation(); return copyText(copyUrl); }

  const deleteAsset = el.closest("[data-delete-asset]")?.dataset.deleteAsset;
  if (deleteAsset) {
    event.stopPropagation();
    if (!confirm("确定删除此素材吗？")) return;
    try {
      await api(`/api/admin/assets/${deleteAsset}`, { method: "DELETE" });
      toast("素材已下架/删除");
      current = "素材库";
      await refreshAndRender();
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  const deleteTask = el.closest("[data-delete-task]")?.dataset.deleteTask;
  if (deleteTask) {
    event.stopPropagation();
    if (!confirm("确定删除这条生成记录吗？结果文件不会从 OSS 删除，只删除管理端记录。")) return;
    try {
      await api(`/api/admin/tasks/${encodeURIComponent(deleteTask)}`, { method: "DELETE" });
      toast("生成记录已删除");
      await refreshAndRender();
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  const deleteVideo = el.closest("[data-delete-video]")?.dataset.deleteVideo;
  if (deleteVideo) {
    event.stopPropagation();
    if (!confirm("确定删除这条视频记录吗？视频文件不会从 OSS 删除，只删除管理端记录。")) return;
    try {
      await api(`/api/admin/videos/${encodeURIComponent(deleteVideo)}`, { method: "DELETE" });
      toast("视频记录已删除");
      await refreshAndRender();
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  // --- Shop Styles ---
  if (el.id === "saveNewStyleBtn") {
    const id = document.querySelector("#newStyleId").value.trim();
    const name = document.querySelector("#newStyleName").value.trim();
    const basePrice = Number(document.querySelector("#newStylePrice").value);
    const image = document.querySelector("#newStyleImage").value.trim();
    if (!id || !name || !basePrice) return toast("请填写款式ID、名称和基础价格");
    try {
      await api("/api/admin/shop/styles", {
        method: "POST",
        body: JSON.stringify({ id, name, basePrice, image })
      });
      toast("款式添加成功");
      await refreshAndRender(renderShopProducts);
    } catch (e) {
      toast(e.message || "保存失败");
    }
    return;
  }
  const editStyleId = el.closest("[data-edit-style]")?.dataset.editStyle;
  if (editStyleId) {
    const style = data.styles.find(s => s.id === editStyleId);
    if (!style) return;
    const name = prompt("输入新名称:", style.name);
    if (name === null) return;
    const basePriceStr = prompt("输入新基础售价:", style.basePrice);
    if (basePriceStr === null) return;
    const basePrice = Number(basePriceStr);
    if (isNaN(basePrice)) return toast("售价必须为数字");
    try {
      await api(`/api/admin/shop/styles/${editStyleId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, basePrice })
      });
      toast("款式修改成功");
      await refreshAndRender(renderShopProducts);
    } catch (e) {
      toast(e.message || "修改失败");
    }
    return;
  }
  const deleteStyleId = el.closest("[data-delete-style]")?.dataset.deleteStyle;
  if (deleteStyleId) {
    if (!confirm("确定要删除此款式吗？")) return;
    try {
      await api(`/api/admin/shop/styles/${deleteStyleId}`, { method: "DELETE" });
      toast("款式已删除");
      await refreshAndRender(renderShopProducts);
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  // --- Shop Fabrics ---
  if (el.id === "saveNewFabricBtn") {
    const id = document.querySelector("#newFabricId").value.trim();
    const name = document.querySelector("#newFabricName").value.trim();
    const composition = document.querySelector("#newFabricComp").value.trim();
    const weight = document.querySelector("#newFabricWeight").value.trim();
    const width = document.querySelector("#newFabricWidth").value.trim();
    const pantone = document.querySelector("#newFabricPantone").value.trim();
    const hex = document.querySelector("#newFabricHex").value;
    const rgb = document.querySelector("#newFabricRgb").value.trim();
    const priceMarkup = Number(document.querySelector("#newFabricMarkup").value || 0);
    if (!id || !name) return toast("请填写面料ID和名称");
    try {
      await api("/api/admin/shop/fabrics", {
        method: "POST",
        body: JSON.stringify({ id, name, composition, weight, width, pantone, hex, rgb, priceMarkup })
      });
      toast("面料添加成功");
      await refreshAndRender(renderShopProducts);
    } catch (e) {
      toast(e.message || "保存失败");
    }
    return;
  }
  const editFabricId = el.closest("[data-edit-fabric]")?.dataset.editFabric;
  if (editFabricId) {
    const fabric = data.fabrics.find(f => f.id === editFabricId);
    if (!fabric) return;
    const name = prompt("输入新名称:", fabric.name);
    if (name === null) return;
    const markupStr = prompt("输入新溢价价格:", fabric.priceMarkup);
    if (markupStr === null) return;
    const priceMarkup = Number(markupStr);
    if (isNaN(priceMarkup)) return toast("溢价必须为数字");
    try {
      await api(`/api/admin/shop/fabrics/${editFabricId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, priceMarkup })
      });
      toast("面料修改成功");
      await refreshAndRender(renderShopProducts);
    } catch (e) {
      toast(e.message || "修改失败");
    }
    return;
  }
  const deleteFabricId = el.closest("[data-delete-fabric]")?.dataset.deleteFabric;
  if (deleteFabricId) {
    if (!confirm("确定要删除此面料吗？")) return;
    try {
      await api(`/api/admin/shop/fabrics/${deleteFabricId}`, { method: "DELETE" });
      toast("面料已删除");
      await refreshAndRender(renderShopProducts);
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  // --- Shop Orders ---
  const payOrderId = el.closest("[data-pay-order]")?.dataset.payOrder;
  if (payOrderId) {
    try {
      await api(`/api/shop/orders/${payOrderId}/pay/mock`, { method: "POST" });
      toast("订单已变更为已支付");
      await refreshAndRender(renderShopOrders);
    } catch (e) {
      toast(e.message || "操作失败");
    }
    return;
  }
  const shipOrderId = el.closest("[data-ship-order]")?.dataset.shipOrder;
  if (shipOrderId) {
    try {
      await api(`/api/admin/shop/orders/${shipOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "shipped" })
      });
      toast("订单已标记为发货");
      await refreshAndRender(renderShopOrders);
    } catch (e) {
      toast(e.message || "操作失败");
    }
    return;
  }
  const completeOrderId = el.closest("[data-complete-order]")?.dataset.completeOrder;
  if (completeOrderId) {
    try {
      await api(`/api/admin/shop/orders/${completeOrderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" })
      });
      toast("订单已标记为完成");
      await refreshAndRender(renderShopOrders);
    } catch (e) {
      toast(e.message || "操作失败");
    }
    return;
  }
  const editOrderAddressId = el.closest("[data-edit-order-address]")?.dataset.editOrderAddress;
  if (editOrderAddressId) {
    const order = data.shopOrders.find(o => o.id === editOrderAddressId);
    if (!order) return;
    const fullName = prompt("收货人姓名:", order.receiver?.fullName || order.receiver?.name || "");
    if (fullName === null) return;
    const phone = prompt("收货人电话:", order.receiver?.phone || "");
    if (phone === null) return;
    const address = prompt("详细收货地址:", order.receiver?.address || "");
    if (address === null) return;
    try {
      await api(`/api/admin/shop/orders/${editOrderAddressId}`, {
        method: "PATCH",
        body: JSON.stringify({ receiver: { fullName, phone, address } })
      });
      toast("地址修改成功");
      await refreshAndRender(renderShopOrders);
    } catch (e) {
      toast(e.message || "修改失败");
    }
    return;
  }
  const deleteOrderId = el.closest("[data-delete-order]")?.dataset.deleteOrder;
  if (deleteOrderId) {
    if (!confirm("确定要删除此订单吗？这将从系统数据库彻底移除此订单。")) return;
    try {
      await api(`/api/admin/shop/orders/${deleteOrderId}`, { method: "DELETE" });
      toast("订单已删除");
      await refreshAndRender(renderShopOrders);
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  // --- Shop Reviews ---
  const deleteReviewId = el.closest("[data-delete-review]")?.dataset.deleteReview;
  if (deleteReviewId) {
    if (!confirm("确定要下架并彻底删除此评价吗？")) return;
    try {
      await api(`/api/admin/shop/reviews/${deleteReviewId}`, { method: "DELETE" });
      toast("评价已成功下架删除");
      await refreshAndRender(renderShopReviews);
    } catch (e) {
      toast(e.message || "删除失败");
    }
    return;
  }

  if (el.id === "uploadAssetBtn") return document.querySelector("#assetUploadInput")?.click();
  const sourceModeBtn = el.closest("[data-fabric-source-mode]");
  if (sourceModeBtn) {
    try {
      await setFabricSourceMode(sourceModeBtn.dataset.fabricSourceMode);
    } catch (error) {
      toast(error.message || "切换失败");
    }
    return;
  }
  if (el.id === "connectFabricTool") {
    try {
      await connectFabricTool();
    } catch (error) {
      fabricTool.connected = false;
      fabricTool.message = error.message || "本机服务连接失败";
      renderFabricWorkbench();
      toast(fabricTool.message);
    }
    return;
  }
  if (el.id === "extractFabricPalette") {
    try {
      fabricTool.palette = readFabricPalette();
      await extractFabricPalette();
    } catch (error) {
      toast(error.message || "提色失败");
    }
    return;
  }
  if (el.id === "pickFabricReference") {
    return document.querySelector("#fabricReferenceInput")?.click();
  }
  if (el.id === "pickFabricBase") {
    return document.querySelector("#fabricBaseInput")?.click();
  }
  if (el.id === "useFabricTemplate") {
    try {
      await loadTemplateFabricBase();
    } catch (error) {
      toast(error.message || "模板加载失败");
    }
    return;
  }
  if (el.id === "clearFabricBase") {
    clearCustomFabricBase();
    return;
  }
  if (el.id === "fabricRecolorBtn") {
    try {
      await recolorFabricTool();
    } catch (error) {
      fabricTool.message = error.message || "本机生成失败";
      renderFabricWorkbench();
      toast(fabricTool.message);
    }
    return;
  }
  if (el.id === "fabricUploadResultBtn") {
    try {
      await uploadFabricToolResult();
    } catch (error) {
      toast(error.message || "上传入库失败");
    }
    return;
  }
  if (el.id === "logoutBtn") {
    await api("/api/admin/logout", { method: "POST", body: JSON.stringify({}) }).catch(() => {});
    location.href = "/admin/login";
    return;
  }

  // --- navigation ---
  const nav = el.closest("[data-nav]")?.dataset.nav;
  if (nav) {
    current = nav;
    if (current === "模型配置") data.modelConfig = await api("/api/admin/model-config");
    if (current === "设置") {
      data.storageConfig = await api("/api/admin/storage-config");
      data.videoConfig = await api("/api/admin/video-config");
    }
    await refreshAndRender();
    return;
  }

  // --- detail buttons (only match actual <button> clicks, not parent cards) ---
  const userBtn = el.closest("button[data-user-detail]");
  if (userBtn) {
    return renderFreshDetail("user", userBtn.dataset.userDetail);
  }

  const taskBtn = el.closest("button[data-detail]");
  if (taskBtn) {
    return renderFreshDetail("task", taskBtn.dataset.detail);
  }

  const videoBtn = el.closest("button[data-video-detail]");
  if (videoBtn) {
    return renderFreshDetail("video", videoBtn.dataset.videoDetail);
  }

  const videoRefresh = el.closest("[data-video-refresh]")?.dataset.videoRefresh;
  if (videoRefresh) return refreshVideoTask(videoRefresh);

  // --- asset detail: button click OR card click ---
  const assetBtn = el.closest("button[data-asset-detail]");
  const assetCard = el.closest("article[data-asset-detail]");
  const assetId = (assetBtn || assetCard)?.dataset.assetDetail;
  if (assetId) {
    return renderFreshDetail("asset", assetId);
  }

  const videoSource = el.closest("[data-video-source]")?.dataset.videoSource;
  if (videoSource) {
    const sourceTask = data.tasks.find((item) => item.id === videoSource);
    const resp = await api("/api/videos", {
      method: "POST",
      body: JSON.stringify({
        sourceTaskId: videoSource,
        imageUrl: sourceTask?.resultUrl,
        publicImageUrl: sourceTask?.resultUrl?.startsWith("http") ? sourceTask.resultUrl : "",
        fallbackToMock: false,
        title: "结果图展示视频",
        prompt: "Generate a short fashion showcase video from the result image. Use a subtle runway camera push-in, keep the outfit, face, body pose and background consistent, emphasize garment texture and premium fashion presentation."
      })
    });
    data.activeVideoTask = resp.videoTask;
    data.videos = (await api("/api/admin/videos")).items;
    current = "视频任务";
    renderVideos();
    refreshVideoTask(resp.videoTaskId);
    return;
  }

  if (el.id === "saveStorageConfig") {
    data.storageConfig = await api("/api/admin/storage-config", {
      method: "POST",
      body: JSON.stringify({
        active: document.querySelector("#storageActive").value,
        oss: {
          enabled: document.querySelector("#ossEnabled").value === "true",
          bucket: document.querySelector("#ossBucket").value.trim(),
          region: document.querySelector("#ossRegion").value.trim(),
          endpoint: document.querySelector("#ossEndpoint").value.trim(),
          publicBaseUrl: document.querySelector("#ossPublicBaseUrl").value.trim(),
          accessKeyId: document.querySelector("#ossAccessKeyId").value.trim(),
          accessKeySecret: document.querySelector("#ossAccessKeySecret").value.trim()
        }
      })
    });
    toast("存储配置已保存");
    renderSettings();
    return;
  }

  if (el.id === "saveVideoConfig") {
    data.videoConfig = await api("/api/admin/video-config", {
      method: "POST",
      body: JSON.stringify({
        activeProvider: document.querySelector("#videoProvider").value,
        model: document.querySelector("#videoModel").value.trim(),
        region: document.querySelector("#videoRegion").value.trim(),
        resolution: document.querySelector("#videoResolution").value.trim(),
        duration: Number(document.querySelector("#videoDuration").value || 5),
        maxWaitSeconds: Number(document.querySelector("#videoWait").value || 600)
      })
    });
    toast("视频配置已保存");
    renderSettings();
    return;
  }

  if (el.id === "saveModelConfig") {
    const field = (id) => document.querySelector(`#${id}`)?.value?.trim() || "";
    const enabled = (id) => field(id) === "true";
    const activeVideoProvider = field("activeVideoProvider");
    const videoModel = activeVideoProvider === "dashscope" ? field("dashscopeVideoModel") : field("doubaoVideoModel");
    const videoRegion = activeVideoProvider === "dashscope" ? field("dashscopeRegion") : field("doubaoRegion");
    data.modelConfig = await api("/api/admin/model-config", {
      method: "POST",
      body: JSON.stringify({
        activeProvider: field("activeProvider"),
        providers: {
          dashscope: {
            enabled: enabled("dashscopeEnabled"),
            apiKey: field("dashscopeKey"),
            region: field("dashscopeRegion"),
            model: field("dashscopeModel"),
            size: field("dashscopeSize"),
            maxWaitSeconds: Number(field("dashscopeWait") || 180),
            promptExtend: enabled("dashscopePromptExtend")
          },
          doubao: {
            enabled: enabled("doubaoEnabled"),
            apiKey: field("doubaoKey"),
            region: field("doubaoRegion"),
            baseUrl: field("doubaoBaseUrl"),
            endpoint: field("doubaoEndpoint"),
            model: field("doubaoModel"),
            size: field("doubaoSize"),
            videoEndpoint: field("doubaoVideoEndpoint"),
            videoModel: field("doubaoVideoModel"),
            threeDModel: field("doubao3dModel"),
            videoResolution: "720p",
            videoDuration: 5,
            maxWaitSeconds: Number(field("doubaoWait") || 180)
          }
        }
      })
    });
    data.videoConfig = await api("/api/admin/video-config", {
      method: "POST",
      body: JSON.stringify({
        activeProvider: activeVideoProvider,
        model: videoModel,
        region: videoRegion,
        resolution: "720P",
        duration: 5,
        maxWaitSeconds: Number(field("doubaoWait") || 600)
      })
    });
    toast("模型配置已保存");
    renderModelConfig();
    return;
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.id === "assetUploadInput") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await uploadAssetFile(file);
    } catch (error) {
      toast(error.message || "上传失败");
    } finally {
      event.target.value = "";
    }
    return;
  }

  if (event.target.id === "fabricToolStyle" || event.target.id === "fabricToolFabric") {
    fabricTool.selectedStyle = document.querySelector("#fabricToolStyle")?.value || fabricTool.selectedStyle;
    fabricTool.selectedFabric = document.querySelector("#fabricToolFabric")?.value || fabricTool.selectedFabric;
    fabricTool.useCustomBase = false;
    fabricTool.resultBase64 = "";
    try {
      await refreshFabricToolOriginal();
    } catch (error) {
      toast(error.message || "预览加载失败");
    }
    return;
  }

  if (event.target.id === "fabricToolLandscape") {
    fabricTool.selectedLandscape = event.target.value;
    fabricTool.uploadedReferenceName = "";
    try {
      await extractFabricPalette();
    } catch (error) {
      toast(error.message || "提色失败");
    }
    return;
  }

  if (event.target.id === "fabricToolTemplate") {
    fabricTool.selectedTemplate = event.target.value;
    fabricTool.resultBase64 = "";
    renderFabricWorkbench();
    return;
  }

  if (event.target.id === "fabricPreserveWhite") {
    fabricTool.preserveWhiteBackground = event.target.value === "true";
    fabricTool.resultBase64 = "";
    renderFabricWorkbench();
    return;
  }

  if (event.target.id === "fabricReferenceInput") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await extractUploadedReference(file);
    } catch (error) {
      toast(error.message || "上传参考图提色失败");
    } finally {
      event.target.value = "";
    }
    return;
  }

  if (event.target.id === "fabricBaseInput") {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await loadCustomFabricBase(file);
    } catch (error) {
      toast(error.message || "上传待处理图失败");
    } finally {
      event.target.value = "";
    }
    return;
  }
});

async function boot() {
  navRoot.innerHTML = navSections.map((section) => `
    <div class="nav-section">
      <div class="nav-section-title">${section.title}</div>
      ${section.items.map(([key, label]) => `<button class="nav-btn ${key === current ? "active" : ""}" data-nav="${key}">${label}</button>`).join("")}
    </div>
  `).join("");
  document.querySelector("#globalSearch")?.addEventListener("input", (event) => {
    searchState.q = event.target.value.trim();
    render();
  });
  document.querySelector("#globalTypeFilter")?.addEventListener("change", (event) => {
    searchState.type = event.target.value;
    render();
  });
  await refreshAll();
  data.modelConfig = await api("/api/admin/model-config");
  data.storageConfig = await api("/api/admin/storage-config");
  data.videoConfig = await api("/api/admin/video-config");
  render();
}

boot().catch((error) => {
  viewRoot.innerHTML = `<section class="panel"><h2>启动失败</h2><p class="error">${error.message}</p></section>`;
});
