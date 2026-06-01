import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFabricMindDb } from "../server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(root, "..");
const serverDir = path.join(root, "server");
const shopResourcesRoot = path.join(workspaceRoot, "dianshang", "电商前端", "public", "resources");

loadEnvFile(path.join(root, ".env"));

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

function readJson(fileName, fallback) {
  const filePath = path.join(serverDir, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function dedupeById(items) {
  const byId = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    byId.set(String(item.id), { ...(byId.get(String(item.id)) || {}), ...item });
  }
  return Array.from(byId.values());
}

function defaultUsers() {
  return [
    { id: "u001", name: "演示用户", nickName: "演示用户", points: 128, total: 24, success: 21, avatar: "/public/home/person-default.png", avatarUrl: "/public/home/person-default.png" },
    { id: "u002", name: "设计师用户", nickName: "设计师用户", points: 92, total: 12, success: 10, avatar: "/public/samples/models/02.jpg", avatarUrl: "/public/samples/models/02.jpg" }
  ];
}

function defaultAssets() {
  return [
    { id: "a001", name: "黑色短袖", type: "上衣", color: "黑色", style: "通勤", status: "上架", url: "/public/samples/outfits/T_shirt.png" },
    { id: "a002", name: "长袖廓形上衣", type: "上衣", color: "灰黑", style: "秀场", status: "上架", url: "/public/samples/outfits/changxiu.png" },
    { id: "a003", name: "短袖基础款", type: "上衣", color: "浅色", style: "休闲", status: "上架", url: "/public/samples/outfits/duanxiu.png" },
    { id: "a004", name: "灰色短裤", type: "下装", color: "灰色", style: "运动", status: "上架", url: "/public/samples/outfits/shorts.png" },
    { id: "a004b", name: "灰色宽松长裤", type: "下装", color: "灰色", style: "通勤", status: "上架", url: "/public/uploads/black-top-gray-pants.png" },
    { id: "a005", name: "织物样片 01", type: "面料", color: "蓝灰", style: "面料", status: "上架", url: "/public/samples/fabrics/fabric1.jpg" },
    { id: "a006", name: "织物样片 02", type: "面料", color: "暖色", style: "面料", status: "上架", url: "/public/samples/fabrics/fabric2.jpg" }
  ];
}

function defaultTaskSnapshot() {
  return {
    tasks: [
      {
        id: "t-demo-001",
        user: "演示用户",
        mode: "整套换装",
        status: "success",
        progress: 100,
        points: 8,
        personUrl: "/public/home/person-default.png",
        garmentUrl: "/public/home/garment-default.png",
        resultUrl: "/public/home/person-default.png",
        prompt: "保持脸部和背景不变，让服装自然贴合身体",
        createdAt: "2026-05-14 20:30"
      }
    ],
    videoTasks: [
      {
        id: "v-demo-001",
        user: "演示用户",
        sourceTaskId: "t-demo-001",
        status: "success",
        progress: 100,
        title: "结果图展示视频",
        style: "runway-pan",
        posterUrl: "/public/home/person-default.png",
        videoUrl: "",
        previewType: "animated-image",
        createdAt: "2026-05-14 20:40",
        finishedAt: "2026-05-14 20:40"
      }
    ]
  };
}

const storedUsers = readJson("runtime-users.json", { items: [] });
const storedAssets = readJson("runtime-assets.json", { items: [] });
const storedTasks = readJson("runtime-tasks.json", defaultTaskSnapshot());
const shopProducts = readJson("runtime-shop-products.json", { styles: [], fabrics: [] });

function enrichShopImages(products) {
  for (const style of products.styles || []) {
    const imagePath = `/resources/style/${style.id}.jpg`;
    if (!style.image && fs.existsSync(path.join(shopResourcesRoot, "style", `${style.id}.jpg`))) {
      style.image = imagePath;
    }
  }
  for (const fabric of products.fabrics || []) {
    const fabricPath = `/resources/fabric/${fabric.id}.jpg`;
    if (!fabric.image && fs.existsSync(path.join(shopResourcesRoot, "fabric", `${fabric.id}.jpg`))) {
      fabric.image = fabricPath;
    }
    fabric.previewUrls = fabric.previewUrls || {};
    for (const style of products.styles || []) {
      const previewFile = path.join(shopResourcesRoot, "kuanshi", `${fabric.id}_${style.id}.png`);
      if (fs.existsSync(previewFile)) {
        fabric.previewUrls[style.id] = fabric.previewUrls[style.id] || `/resources/kuanshi/${fabric.id}_${style.id}.png`;
      }
    }
  }
  return products;
}

enrichShopImages(shopProducts);

const snapshot = {
  runtimeConfig: readJson("runtime-config.json", null),
  users: dedupeById([...defaultUsers(), ...(storedUsers.items || [])]),
  userSessions: readJson("runtime-user-sessions.json", []),
  assets: dedupeById([...defaultAssets(), ...(storedAssets.items || [])]),
  tasks: storedTasks.tasks || [],
  videoTasks: storedTasks.videoTasks || [],
  shopProducts,
  shopOrders: readJson("runtime-shop-orders.json", []),
  shopReviews: readJson("runtime-shop-reviews.json", [])
};

const db = await createFabricMindDb();
if (!db.enabled) {
  throw new Error(db.reason || "MySQL 未启用");
}

await db.persistAll(snapshot);
await db.close();

console.log("迁移完成：");
console.log(`users=${snapshot.users.length}`);
console.log(`user_sessions=${snapshot.userSessions.length}`);
console.log(`assets=${snapshot.assets.length}`);
console.log(`generation_tasks=${snapshot.tasks.length}`);
console.log(`video_tasks=${snapshot.videoTasks.length}`);
console.log(`shop_styles=${snapshot.shopProducts.styles.length}`);
console.log(`shop_fabrics=${snapshot.shopProducts.fabrics.length}`);
console.log(`shop_orders=${snapshot.shopOrders.length}`);
console.log(`shop_reviews=${snapshot.shopReviews.length}`);
console.log(`runtime_config=${snapshot.runtimeConfig ? 1 : 0}`);
