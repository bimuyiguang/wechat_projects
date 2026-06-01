import fs from "node:fs";
import path from "node:path";

const base = process.env.FABRICMIND_BASE_URL || "http://127.0.0.1:5177";
const root = path.resolve(process.cwd());
const results = [];
let adminCookie = "";

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(pathname) {
  const res = await fetch(`${base}${pathname}`, { headers: adminCookie ? { cookie: adminCookie } : {} });
  const data = await res.json();
  assert(res.ok, `${pathname} returned ${res.status}`);
  return data;
}

async function postJson(pathname, body) {
  const res = await fetch(`${base}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(adminCookie ? { cookie: adminCookie } : {}) },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  assert(res.ok, `${pathname} returned ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function deleteJson(pathname) {
  const res = await fetch(`${base}${pathname}`, {
    method: "DELETE",
    headers: adminCookie ? { cookie: adminCookie } : {}
  });
  const data = await res.json();
  assert(res.ok, `${pathname} returned ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function waitTask(id) {
  let task;
  for (let i = 0; i < 20; i += 1) {
    task = await getJson(`/api/tasks/${id}`);
    if (["success", "failed"].includes(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`task ${id} timed out`);
}

async function test(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (error) {
    record(name, false, error.message);
  }
}

await test("health endpoint", async () => {
  const data = await getJson("/api/health");
  assert(data.ok === true, "health not ok");
  return `provider=${data.activeProvider}`;
});

await test("admin login gate", async () => {
  const unauth = await fetch(`${base}/api/admin/users`);
  assert(unauth.status === 401, `expected 401 got ${unauth.status}`);
  const challenge = await getJson("/api/admin/challenge");
  const nums = (challenge.question || "").match(/\d+/g)?.map(Number) || [];
  const answer = challenge.debugAnswer || (nums.length >= 2 ? String(nums[0] + nums[1]) : "");
  assert(answer, "challenge answer is not available for smoke test");
  const res = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "User", password: "12345678", challengeId: challenge.id, challengeAnswer: answer })
  });
  const body = await res.json();
  assert(res.ok && body.ok, `login failed ${res.status}`);
  adminCookie = (res.headers.get("set-cookie") || "").split(";")[0];
  assert(adminCookie.includes("fm_admin_session="), "missing admin session cookie");
  const me = await getJson("/api/admin/me");
  assert(me.ok && me.user === "User", "admin me invalid");
  return "challenge/login/cookie ok";
});

await test("static pages", async () => {
  for (const pathname of ["/mobile", "/admin"]) {
    const res = await fetch(`${base}${pathname}`, { headers: pathname === "/admin" ? { cookie: adminCookie } : {} });
    assert(res.status === 200, `${pathname} status ${res.status}`);
    const text = await res.text();
    assert(text.includes("FabricMind"), `${pathname} missing FabricMind`);
  }
  return "mobile/admin ok";
});

await test("asset APIs", async () => {
  const assets = await getJson("/api/assets");
  assert(Array.isArray(assets.items) && assets.items.length >= 4, "not enough assets");
  const filtered = await getJson(`/api/assets?type=${encodeURIComponent("上衣")}`);
  assert(filtered.items.every((item) => item.type === "上衣"), "filter failed");
  return `${assets.items.length} assets`;
});

await test("admin list APIs", async () => {
  const users = await getJson("/api/admin/users");
  const assets = await getJson("/api/admin/assets");
  const tasks = await getJson("/api/admin/tasks");
  const results = await getJson("/api/admin/results");
  const videos = await getJson("/api/admin/videos");
  assert(users.items.length > 0, "users empty");
  assert(assets.items.length > 0, "assets empty");
  assert(Array.isArray(tasks.items), "tasks invalid");
  assert(Array.isArray(results.items), "results invalid");
  assert(Array.isArray(videos.items), "videos invalid");
  return "users/assets/tasks/results/videos ok";
});

await test("model config privacy and save", async () => {
  const cfg = await getJson("/api/admin/model-config");
  assert(!("apiKey" in cfg.providers.dashscope), "dashscope key leaked");
  const saved = await postJson("/api/admin/model-config", {
    activeProvider: cfg.activeProvider,
    providers: {
      dashscope: {
        region: cfg.providers.dashscope.region,
        model: cfg.providers.dashscope.model,
        size: cfg.providers.dashscope.size,
        maxWaitSeconds: cfg.providers.dashscope.maxWaitSeconds,
        promptExtend: cfg.providers.dashscope.promptExtend
      }
    }
  });
  assert(!("apiKey" in saved.providers.dashscope), "saved config leaked key");
  return `hasKey=${saved.providers.dashscope.hasKey}`;
});

await test("storage and video config APIs", async () => {
  const storage = await getJson("/api/admin/storage-config");
  assert(!("accessKeyId" in storage.oss), "oss access key leaked");
  assert(!("accessKeySecret" in storage.oss), "oss secret leaked");
  const savedStorage = await postJson("/api/admin/storage-config", {
    active: storage.active || "local",
    oss: {
      enabled: Boolean(storage.oss.enabled),
      bucket: storage.oss.bucket || "",
      region: storage.oss.region || "",
      endpoint: storage.oss.endpoint || "",
      publicBaseUrl: storage.oss.publicBaseUrl || ""
    }
  });
  assert(!("accessKeySecret" in savedStorage.oss), "saved oss secret leaked");

  const video = await getJson("/api/admin/video-config");
  const savedVideo = await postJson("/api/admin/video-config", {
    activeProvider: video.activeProvider || "doubao",
    model: video.model || "doubao-seedance-1-0-lite-i2v-250428",
    region: video.region || "cn-beijing",
    resolution: video.resolution || "720P",
    duration: Number(video.duration || 2),
    maxWaitSeconds: Number(video.maxWaitSeconds || 600)
  });
  assert(savedVideo.model, "video model missing");
  return `${savedStorage.active}/${savedVideo.model}`;
});

await test("upload mock API", async () => {
  const uploaded = await postJson("/api/uploads", { url: "/public/uploads/runway-person.png" });
  assert(uploaded.url.includes("/public/") || uploaded.url.startsWith("http"), "upload url invalid");
  assert(uploaded.ossKey, "oss key invalid");
  return `${uploaded.storage}:${uploaded.ossKey}`;
});

await test("temporary upload API", async () => {
  const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const uploaded = await postJson("/api/uploads/temp", {
    kind: "person",
    filename: "smoke.png",
    contentType: "image/png",
    base64: onePixelPng
  });
  assert(uploaded.storage === "local-temp", "temp upload should stay local");
  assert(uploaded.url.startsWith("/public/tmp-uploads/"), "temp upload url invalid");
  return uploaded.url;
});

await test("generation try-on mock flow", async () => {
  const created = await postJson("/api/generation/try-on", {
    provider: "mock",
    mode: "Smoke Test",
    prompt: "test prompt",
    personUrl: "/public/uploads/runway-person.png",
    garmentUrl: "/public/uploads/black-top-gray-pants.png",
    transient: true
  });
  const task = await waitTask(created.taskId);
  assert(task.status === "success", `task status ${task.status}`);
  assert(task.resultUrl, "missing result url");
  return task.resultUrl;
});

await test("admin model-test mock flow", async () => {
  const created = await postJson("/api/admin/model-test", {
    provider: "mock",
    prompt: "admin test prompt",
    fallbackToMock: true,
    transient: true
  });
  const task = await waitTask(created.taskId);
  assert(task.status === "success", `task status ${task.status}`);
  return task.id;
});

await test("video task mock flow", async () => {
  const created = await postJson("/api/videos", {
    provider: "mock",
    sourceTaskId: "t-demo-001",
    imageUrl: "/public/samples/fabrics/fabric3.jpg",
    fallbackToMock: true,
    transient: true
  });
  const started = await getJson(`/api/videos/${created.videoTaskId}`);
  assert(started.id === created.videoTaskId, "video task not found");
  let task = started;
  for (let i = 0; i < 10; i += 1) {
    task = await getJson(`/api/videos/${created.videoTaskId}`);
    if (["success", "failed"].includes(task.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(task.status === "success", `video task status ${task.status}`);
  return task.id;
});

await test("invalid task returns 404", async () => {
  const res = await fetch(`${base}/api/tasks/not-found`);
  assert(res.status === 404, `expected 404 got ${res.status}`);
  return "404 ok";
});

await test("admin delete APIs", async () => {
  const createdTask = await postJson("/api/admin/model-test", { provider: "mock", transient: true, prompt: "delete smoke" });
  const deletedTask = await deleteJson(`/api/admin/tasks/${createdTask.taskId}`);
  assert(deletedTask.success === true, "task delete failed");
  const createdVideo = await postJson("/api/videos", { provider: "mock", transient: true, sourceTaskId: "t-demo-001" });
  const deletedVideo = await deleteJson(`/api/admin/videos/${createdVideo.videoTaskId}`);
  assert(deletedVideo.success === true, "video delete failed");
  return "task/video delete ok";
});

await test("miniprogram files", async () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram", "app.json"), "utf8"));
  for (const page of appJson.pages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      const file = path.join(root, "miniprogram", `${page}.${ext}`);
      assert(fs.existsSync(file), `missing ${file}`);
    }
  }
  const appJs = fs.readFileSync(path.join(root, "miniprogram", "app.js"), "utf8");
  assert(/baseUrl:\s*["']https?:\/\//.test(appJs), "baseUrl not configured");
  return `${appJson.pages.length} pages`;
});

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.length - failed.length}/${results.length} tests passed`);
if (failed.length) process.exit(1);
