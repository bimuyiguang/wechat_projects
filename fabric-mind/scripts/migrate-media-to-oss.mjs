import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createFabricMindDb } from "../server/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(root, "..");
const shopPublicRoot = path.join(workspaceRoot, "dianshang", "电商前端", "public");

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

function normalizeEndpoint(endpoint = "") {
  return endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function getOssConfig(runtimeConfig) {
  const oss = runtimeConfig?.storage?.oss || {};
  const endpoint = normalizeEndpoint(oss.endpoint || process.env.ALIYUN_OSS_ENDPOINT || "");
  const bucket = oss.bucket || oss.bucketName || process.env.ALIYUN_OSS_BUCKET || "";
  const accessKeyId = oss.accessKeyId || process.env.ALIYUN_OSS_ACCESS_KEY_ID || "";
  const accessKeySecret = oss.accessKeySecret || process.env.ALIYUN_OSS_ACCESS_KEY_SECRET || "";
  const publicBaseUrl = (oss.publicBaseUrl || (bucket && endpoint ? `https://${bucket}.${endpoint}` : "")).replace(/\/+$/, "");
  return { endpoint, bucket, accessKeyId, accessKeySecret, publicBaseUrl };
}

function contentTypeFromName(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

function isCloudUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function localUrlToFile(url) {
  if (typeof url !== "string" || !url.startsWith("/")) return null;
  const clean = decodeURIComponent(url.split("?")[0].split("#")[0]);
  if (clean.startsWith("/public/")) return path.join(root, clean.slice(1));
  if (clean.startsWith("/resources/")) return path.join(shopPublicRoot, clean.slice(1));
  return null;
}

function safeName(value) {
  return String(value || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function objectKeyFor(item, url) {
  const clean = decodeURIComponent(url.split("?")[0].split("#")[0]);
  const ext = path.extname(clean) || ".bin";
  const basename = path.basename(clean, ext);
  return [
    "fabricmind",
    item.visibility === "private" ? "private" : "public",
    item.category,
    safeName(item.ownerType),
    safeName(item.ownerId),
    `${safeName(item.fieldName)}-${safeName(basename)}${ext.toLowerCase()}`
  ].join("/");
}

async function uploadBufferToOss(cfg, buffer, objectKey, contentType) {
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

function addCandidate(items, item) {
  if (!item.url || isCloudUrl(item.url)) return;
  const filePath = localUrlToFile(item.url);
  if (!filePath || !fs.existsSync(filePath)) {
    items.missing.push({ ...item, filePath: filePath || "" });
    return;
  }
  items.uploads.push({ ...item, filePath });
}

async function ensureMediaFilesTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id VARCHAR(128) PRIMARY KEY,
      owner_type VARCHAR(64) NOT NULL,
      owner_id VARCHAR(128) NOT NULL,
      field_name VARCHAR(64) NOT NULL,
      original_url TEXT NULL,
      storage VARCHAR(32) NOT NULL DEFAULT 'oss',
      bucket VARCHAR(128) NULL,
      oss_key TEXT NULL,
      public_url TEXT NULL,
      visibility VARCHAR(32) NOT NULL DEFAULT 'public',
      mime_type VARCHAR(128) NULL,
      file_size BIGINT NULL,
      source_table VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_media_owner (owner_type, owner_id),
      INDEX idx_media_visibility (visibility)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function main() {
  const db = await createFabricMindDb();
  if (!db.enabled) throw new Error(db.reason || "MySQL 未启用");
  await ensureMediaFilesTable(db.pool);

  const snapshot = await db.loadAll();
  const cfg = getOssConfig(snapshot.runtimeConfig);
  if (!cfg.endpoint || !cfg.bucket || !cfg.accessKeyId || !cfg.accessKeySecret || !cfg.publicBaseUrl) {
    throw new Error("OSS 配置不完整，无法上传");
  }

  const items = { uploads: [], missing: [] };

  for (const user of snapshot.users) {
    addCandidate(items, { sourceTable: "users", ownerType: "user", ownerId: user.id, fieldName: "avatar", url: user.avatar, visibility: "public", category: "avatars" });
    addCandidate(items, { sourceTable: "users", ownerType: "user", ownerId: user.id, fieldName: "avatarUrl", url: user.avatarUrl, visibility: "public", category: "avatars" });
  }

  for (const asset of snapshot.assets) {
    addCandidate(items, { sourceTable: "assets", ownerType: "asset", ownerId: asset.id, fieldName: "url", url: asset.url, visibility: "public", category: "assets" });
    addCandidate(items, { sourceTable: "assets", ownerType: "asset", ownerId: asset.id, fieldName: "localUrl", url: asset.localUrl, visibility: "public", category: "assets" });
  }

  for (const style of snapshot.shopProducts?.styles || []) {
    addCandidate(items, { sourceTable: "shop_styles", ownerType: "style", ownerId: style.id, fieldName: "image", url: style.image, visibility: "public", category: "shop/styles" });
  }

  for (const fabric of snapshot.shopProducts?.fabrics || []) {
    addCandidate(items, { sourceTable: "shop_fabrics", ownerType: "fabric", ownerId: fabric.id, fieldName: "image", url: fabric.image, visibility: "public", category: "shop/fabrics" });
  }

  const [previewRows] = await db.pool.query("SELECT * FROM shop_preview_images ORDER BY fabric_id, style_id");
  for (const row of previewRows) {
    addCandidate(items, {
      sourceTable: "shop_preview_images",
      ownerType: "preview",
      ownerId: row.id,
      fieldName: "image_url",
      url: row.oss_url || row.image_url,
      visibility: "public",
      category: "shop/previews",
      previewRow: row
    });
  }

  for (const task of snapshot.tasks) {
    addCandidate(items, { sourceTable: "generation_tasks", ownerType: "task", ownerId: task.id, fieldName: "personUrl", url: task.personUrl, visibility: "private", category: "tasks" });
    addCandidate(items, { sourceTable: "generation_tasks", ownerType: "task", ownerId: task.id, fieldName: "garmentUrl", url: task.garmentUrl, visibility: "private", category: "tasks" });
    addCandidate(items, { sourceTable: "generation_tasks", ownerType: "task", ownerId: task.id, fieldName: "resultUrl", url: task.resultUrl, visibility: "private", category: "tasks" });
  }

  for (const video of snapshot.videoTasks) {
    addCandidate(items, { sourceTable: "video_tasks", ownerType: "video", ownerId: video.id, fieldName: "posterUrl", url: video.posterUrl, visibility: "private", category: "videos" });
    addCandidate(items, { sourceTable: "video_tasks", ownerType: "video", ownerId: video.id, fieldName: "videoUrl", url: video.videoUrl, visibility: "private", category: "videos" });
  }

  const cache = new Map();
  const uploaded = [];
  for (const item of items.uploads) {
    const cacheKey = `${item.visibility}|${item.category}|${item.url}`;
    let result = cache.get(cacheKey);
    if (!result) {
      const buffer = fs.readFileSync(item.filePath);
      const mimeType = contentTypeFromName(item.filePath);
      const ossKey = objectKeyFor(item, item.url);
      const publicUrl = await uploadBufferToOss(cfg, buffer, ossKey, mimeType);
      result = { ossKey, publicUrl, mimeType, fileSize: buffer.length };
      cache.set(cacheKey, result);
    }
    uploaded.push({ ...item, ...result });
  }

  for (const item of uploaded) {
    await db.pool.query(
      `REPLACE INTO media_files
       (id, owner_type, owner_id, field_name, original_url, storage, bucket, oss_key, public_url, visibility, mime_type, file_size, source_table)
       VALUES (?, ?, ?, ?, ?, 'oss', ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.createHash("sha1").update(`${item.sourceTable}|${item.ownerType}|${item.ownerId}|${item.fieldName}|${item.url}`).digest("hex"),
        item.ownerType,
        String(item.ownerId),
        item.fieldName,
        item.url,
        cfg.bucket,
        item.ossKey,
        item.publicUrl,
        item.visibility,
        item.mimeType,
        item.fileSize,
        item.sourceTable
      ]
    );
  }

  function replaceField(list, id, fieldName, value) {
    const row = list.find((item) => item.id === id);
    if (row) row[fieldName] = value;
  }

  for (const item of uploaded) {
    if (item.sourceTable === "users") replaceField(snapshot.users, item.ownerId, item.fieldName, item.publicUrl);
    if (item.sourceTable === "assets") {
      const asset = snapshot.assets.find((row) => row.id === item.ownerId);
      if (asset) {
        asset[item.fieldName] = item.publicUrl;
        asset.ossUrl = asset.ossUrl || item.publicUrl;
        asset.ossKey = asset.ossKey || item.ossKey;
      }
    }
    if (item.sourceTable === "shop_styles") replaceField(snapshot.shopProducts.styles, item.ownerId, "image", item.publicUrl);
    if (item.sourceTable === "shop_fabrics") replaceField(snapshot.shopProducts.fabrics, item.ownerId, "image", item.publicUrl);
    if (item.sourceTable === "generation_tasks") replaceField(snapshot.tasks, item.ownerId, item.fieldName, item.publicUrl);
    if (item.sourceTable === "video_tasks") replaceField(snapshot.videoTasks, item.ownerId, item.fieldName, item.publicUrl);
    if (item.sourceTable === "shop_preview_images") {
      const row = previewRows.find((preview) => preview.id === item.ownerId);
      if (row) {
        row.oss_url = item.publicUrl;
        row.oss_key = item.ossKey;
        row.image_url = item.publicUrl;
      }
    }
  }

  await db.persistAll(snapshot);
  for (const row of previewRows) {
    await db.pool.query(
      "REPLACE INTO shop_preview_images (id, style_id, fabric_id, image_url, oss_url, oss_key, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [row.id, row.style_id, row.fabric_id, row.image_url, row.oss_url, row.oss_key, row.visibility || "public"]
    );
  }

  await db.close();

  const summary = uploaded.reduce((acc, item) => {
    const key = `${item.visibility}:${item.category}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log("OSS 媒体迁移完成");
  console.log(JSON.stringify({ uploaded: uploaded.length, uniqueFiles: cache.size, missing: items.missing.length, summary, missingItems: items.missing }, null, 2));
}

await main();
