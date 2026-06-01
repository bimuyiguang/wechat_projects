import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] != null) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

function mysqlConfigFromEnv() {
  return {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || "",
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    database: process.env.MYSQL_DATABASE || process.env.MYSQL_DB || process.env.DB_DATABASE || "",
    user: process.env.MYSQL_USER || process.env.DB_USER || "",
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || ""
  };
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

loadEnvFile(path.join(root, ".env"));
const config = mysqlConfigFromEnv();
if (!config.host || !config.database || !config.user) {
  throw new Error("MySQL 配置不完整，请检查 fabric-mind/.env");
}

const tables = [
  "users",
  "user_sessions",
  "assets",
  "generation_tasks",
  "video_tasks",
  "shop_styles",
  "shop_fabrics",
  "shop_preview_images",
  "shop_orders",
  "shop_reviews",
  "runtime_config",
  "media_files",
  "migration_log"
];

const conn = await mysql.createConnection({ ...config, charset: "utf8mb4" });
const backup = {
  createdAt: new Date().toISOString(),
  database: config.database,
  tables: {}
};

try {
  for (const table of tables) {
    const [exists] = await conn.query(
      "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [config.database, table]
    );
    if (!Number(exists[0]?.count || 0)) continue;
    const [rows] = await conn.query(`SELECT * FROM ${table}`);
    backup.tables[table] = rows;
  }
} finally {
  await conn.end();
}

const backupDir = path.join(root, "backups");
fs.mkdirSync(backupDir, { recursive: true });
const file = path.join(backupDir, `mysql-backup-${stamp()}.json`);
fs.writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");
console.log(`MySQL 备份已写入: ${file}`);
