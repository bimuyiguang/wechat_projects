import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
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

function optionalText(value) {
  return value == null || value === "" ? null : String(value);
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function boolOrNull(value) {
  if (value == null) return null;
  return value ? 1 : 0;
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return JSON.parse(value);
}

loadEnvFile(path.join(root, ".env"));
const config = mysqlConfigFromEnv();
if (!config.host || !config.database || !config.user) {
  throw new Error("MySQL 配置不完整，请检查 fabric-mind/.env");
}

const conn = await mysql.createConnection({ ...config, charset: "utf8mb4" });

try {
  await conn.beginTransaction();

  await conn.query(`
    CREATE TABLE IF NOT EXISTS runtime_storage_config (
      config_key VARCHAR(64) PRIMARY KEY,
      active VARCHAR(64) NULL,
      local_base_url TEXT NULL,
      local_note TEXT NULL,
      oss_enabled TINYINT(1) NULL,
      oss_bucket VARCHAR(191) NULL,
      oss_region VARCHAR(128) NULL,
      oss_endpoint TEXT NULL,
      oss_public_base_url TEXT NULL,
      oss_access_key_id TEXT NULL,
      oss_access_key_secret TEXT NULL,
      oss_note TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS runtime_video_config (
      config_key VARCHAR(64) PRIMARY KEY,
      active_provider VARCHAR(64) NULL,
      region VARCHAR(128) NULL,
      model VARCHAR(191) NULL,
      resolution VARCHAR(64) NULL,
      duration INT NULL,
      prompt_extend TINYINT(1) NULL,
      watermark TINYINT(1) NULL,
      max_wait_seconds INT NULL,
      mock_duration_seconds INT NULL,
      note TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS runtime_provider_configs (
      provider_key VARCHAR(64) PRIMARY KEY,
      enabled TINYINT(1) NULL,
      api_key TEXT NULL,
      region VARCHAR(128) NULL,
      endpoint TEXT NULL,
      base_url TEXT NULL,
      model VARCHAR(191) NULL,
      size VARCHAR(64) NULL,
      prompt_extend TINYINT(1) NULL,
      max_wait_seconds INT NULL,
      video_endpoint TEXT NULL,
      video_model VARCHAR(191) NULL,
      three_d_model VARCHAR(191) NULL,
      video_resolution VARCHAR(64) NULL,
      video_duration INT NULL,
      note TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [columns] = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'runtime_config'",
    [config.database]
  );
  const columnNames = new Set(columns.map((row) => row.COLUMN_NAME));
  const hasDataColumn = columnNames.has("data");

  let runtimeConfig = null;
  if (hasDataColumn) {
    const [rows] = await conn.query("SELECT data FROM runtime_config WHERE config_key = 'default' LIMIT 1");
    runtimeConfig = parseJson(rows[0]?.data);
  }
  if (!runtimeConfig) {
    const [configRows] = await conn.query("SELECT * FROM runtime_config WHERE config_key = 'default' LIMIT 1");
    const [storageRows] = await conn.query("SELECT * FROM runtime_storage_config WHERE config_key = 'default' LIMIT 1");
    const [videoRows] = await conn.query("SELECT * FROM runtime_video_config WHERE config_key = 'default' LIMIT 1");
    const [providerRows] = await conn.query("SELECT * FROM runtime_provider_configs");
    runtimeConfig = {
      activeProvider: configRows[0]?.active_provider || "",
      storage: {
        active: storageRows[0]?.active || "",
        local: {
          baseUrl: storageRows[0]?.local_base_url || "",
          note: storageRows[0]?.local_note || ""
        },
        oss: {
          enabled: Boolean(storageRows[0]?.oss_enabled),
          bucket: storageRows[0]?.oss_bucket || "",
          region: storageRows[0]?.oss_region || "",
          endpoint: storageRows[0]?.oss_endpoint || "",
          publicBaseUrl: storageRows[0]?.oss_public_base_url || "",
          accessKeyId: storageRows[0]?.oss_access_key_id || "",
          accessKeySecret: storageRows[0]?.oss_access_key_secret || "",
          note: storageRows[0]?.oss_note || ""
        }
      },
      video: {
        activeProvider: videoRows[0]?.active_provider || configRows[0]?.video_provider || ""
      },
      providers: Object.fromEntries(providerRows.map((row) => [row.provider_key, {}]))
    };
  }

  if (hasDataColumn) {
    await conn.query(
      "REPLACE INTO runtime_config (config_key, active_provider, storage_active, video_provider, data) VALUES (?, ?, ?, ?, ?)",
      [
        "default",
        optionalText(runtimeConfig.activeProvider),
        optionalText(runtimeConfig.storage?.active),
        optionalText(runtimeConfig.video?.activeProvider),
        JSON.stringify(runtimeConfig)
      ]
    );
  } else {
    await conn.query(
      "REPLACE INTO runtime_config (config_key, active_provider, storage_active, video_provider) VALUES (?, ?, ?, ?)",
      [
        "default",
        optionalText(runtimeConfig.activeProvider),
        optionalText(runtimeConfig.storage?.active),
        optionalText(runtimeConfig.video?.activeProvider)
      ]
    );
  }

  const storage = runtimeConfig.storage || {};
  const local = storage.local || {};
  const oss = storage.oss || {};
  await conn.query(
    "REPLACE INTO runtime_storage_config (config_key, active, local_base_url, local_note, oss_enabled, oss_bucket, oss_region, oss_endpoint, oss_public_base_url, oss_access_key_id, oss_access_key_secret, oss_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      "default",
      optionalText(storage.active),
      optionalText(local.baseUrl),
      optionalText(local.note),
      boolOrNull(oss.enabled),
      optionalText(oss.bucket),
      optionalText(oss.region),
      optionalText(oss.endpoint),
      optionalText(oss.publicBaseUrl),
      optionalText(oss.accessKeyId),
      optionalText(oss.accessKeySecret),
      optionalText(oss.note)
    ]
  );

  const video = runtimeConfig.video || {};
  await conn.query(
    "REPLACE INTO runtime_video_config (config_key, active_provider, region, model, resolution, duration, prompt_extend, watermark, max_wait_seconds, mock_duration_seconds, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      "default",
      optionalText(video.activeProvider),
      optionalText(video.region),
      optionalText(video.model),
      optionalText(video.resolution),
      numberOrNull(video.duration),
      boolOrNull(video.promptExtend),
      boolOrNull(video.watermark),
      numberOrNull(video.maxWaitSeconds),
      numberOrNull(video.mockDurationSeconds),
      optionalText(video.note)
    ]
  );

  await conn.query("DELETE FROM runtime_provider_configs");
  for (const [providerKey, item] of Object.entries(runtimeConfig.providers || {})) {
    await conn.query(
      "INSERT INTO runtime_provider_configs (provider_key, enabled, api_key, region, endpoint, base_url, model, size, prompt_extend, max_wait_seconds, video_endpoint, video_model, three_d_model, video_resolution, video_duration, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        providerKey,
        boolOrNull(item.enabled),
        optionalText(item.apiKey),
        optionalText(item.region),
        optionalText(item.endpoint),
        optionalText(item.baseUrl),
        optionalText(item.model),
        optionalText(item.size),
        boolOrNull(item.promptExtend),
        numberOrNull(item.maxWaitSeconds),
        optionalText(item.videoEndpoint),
        optionalText(item.videoModel),
        optionalText(item.threeDModel),
        optionalText(item.videoResolution),
        numberOrNull(item.videoDuration),
        optionalText(item.note)
      ]
    );
  }

  if (hasDataColumn) {
    await conn.query("ALTER TABLE runtime_config DROP COLUMN data");
  }

  await conn.commit();
  console.log(JSON.stringify({
    runtimeConfig: "split",
    providers: Object.keys(runtimeConfig.providers || {}).length,
    droppedRuntimeData: hasDataColumn
  }, null, 2));
} catch (error) {
  await conn.rollback();
  throw error;
} finally {
  await conn.end();
}
