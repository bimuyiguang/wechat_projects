import mysql from "mysql2/promise";

function mysqlConfigFromEnv() {
  const host = process.env.MYSQL_HOST || process.env.DB_HOST || "";
  const database = process.env.MYSQL_DATABASE || process.env.MYSQL_DB || process.env.DB_DATABASE || "";
  const user = process.env.MYSQL_USER || process.env.DB_USER || "";
  const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "";
  const port = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
  return { host, port, database, user, password };
}

function hasMysqlConfig(config) {
  return Boolean(config.host && config.database && config.user);
}

function toJson(value) {
  return JSON.stringify(value ?? null);
}

function fromJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function text(value) {
  return value == null ? "" : String(value);
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

function firstOf(item, keys) {
  for (const key of keys) {
    if (item?.[key] != null && item[key] !== "") return item[key];
  }
  return null;
}

async function replaceRows(conn, table, rows, mapper) {
  await conn.query(`DELETE FROM ${table}`);
  for (const row of rows) {
    await mapper(row);
  }
}

export async function createFabricMindDb() {
  const config = mysqlConfigFromEnv();
  if (!hasMysqlConfig(config)) {
    return {
      enabled: false,
      reason: "MYSQL_HOST/MYSQL_DATABASE/MYSQL_USER 未完整配置"
    };
  }

  const databaseName = `\`${String(config.database).replace(/`/g, "``")}\``;
  const bootstrap = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: "utf8mb4"
  });
  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await bootstrap.end();
  }

  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    charset: "utf8mb4"
  });

  async function columnExists(table, column) {
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [config.database, table, column]
    );
    return Number(rows[0]?.count || 0) > 0;
  }

  async function ensureColumn(table, column, definition) {
    if (await columnExists(table, column)) return;
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  async function ensureColumns(table, columns) {
    for (const [column, definition] of columns) {
      await ensureColumn(table, column, definition);
    }
  }

  async function initSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NULL,
        nick_name VARCHAR(128) NULL,
        points INT NULL,
        total INT NULL,
        success INT NULL,
        avatar_url TEXT NULL,
        unionid VARCHAR(128) NULL,
        mini_openid VARCHAR(128) NULL,
        web_openid VARCHAR(128) NULL,
        last_check_in_date VARCHAR(32) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_unionid (unionid),
        INDEX idx_users_mini_openid (mini_openid),
        INDEX idx_users_web_openid (web_openid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("users", [
      ["total", "INT NULL"],
      ["success", "INT NULL"],
      ["avatar_url", "TEXT NULL"],
      ["unionid", "VARCHAR(128) NULL"],
      ["mini_openid", "VARCHAR(128) NULL"],
      ["web_openid", "VARCHAR(128) NULL"],
      ["last_check_in_date", "VARCHAR(32) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token VARCHAR(191) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        source VARCHAR(64) NULL,
        created_at_ms BIGINT NULL,
        expires_at BIGINT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_sessions_user_id (user_id),
        INDEX idx_user_sessions_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("user_sessions", [["created_at_ms", "BIGINT NULL"]]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(191) NULL,
        type VARCHAR(64) NULL,
        color VARCHAR(64) NULL,
        style VARCHAR(128) NULL,
        status VARCHAR(64) NULL,
        url TEXT NULL,
        local_url TEXT NULL,
        oss_url TEXT NULL,
        oss_key TEXT NULL,
        created_at_text VARCHAR(64) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_assets_type (type),
        INDEX idx_assets_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("assets", [
      ["color", "VARCHAR(64) NULL"],
      ["style", "VARCHAR(128) NULL"],
      ["local_url", "TEXT NULL"],
      ["oss_key", "TEXT NULL"],
      ["created_at_text", "VARCHAR(64) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS generation_tasks (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        user_name VARCHAR(128) NULL,
        mode VARCHAR(64) NULL,
        status VARCHAR(64) NULL,
        progress INT NULL,
        points INT NULL,
        provider VARCHAR(64) NULL,
        model VARCHAR(128) NULL,
        person_url TEXT NULL,
        garment_url TEXT NULL,
        result_url TEXT NULL,
        prompt TEXT NULL,
        error_message TEXT NULL,
        created_at_text VARCHAR(64) NULL,
        finished_at_text VARCHAR(64) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_generation_tasks_user_id (user_id),
        INDEX idx_generation_tasks_status (status),
        INDEX idx_generation_tasks_provider (provider)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("generation_tasks", [
      ["user_name", "VARCHAR(128) NULL"],
      ["mode", "VARCHAR(64) NULL"],
      ["progress", "INT NULL"],
      ["points", "INT NULL"],
      ["model", "VARCHAR(128) NULL"],
      ["person_url", "TEXT NULL"],
      ["garment_url", "TEXT NULL"],
      ["prompt", "TEXT NULL"],
      ["error_message", "TEXT NULL"],
      ["created_at_text", "VARCHAR(64) NULL"],
      ["finished_at_text", "VARCHAR(64) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_tasks (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        user_name VARCHAR(128) NULL,
        source_task_id VARCHAR(64) NULL,
        title VARCHAR(191) NULL,
        style VARCHAR(128) NULL,
        status VARCHAR(64) NULL,
        progress INT NULL,
        provider VARCHAR(64) NULL,
        model VARCHAR(128) NULL,
        poster_url TEXT NULL,
        video_url TEXT NULL,
        preview_type VARCHAR(64) NULL,
        error_message TEXT NULL,
        created_at_text VARCHAR(64) NULL,
        finished_at_text VARCHAR(64) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_video_tasks_user_id (user_id),
        INDEX idx_video_tasks_source_task_id (source_task_id),
        INDEX idx_video_tasks_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("video_tasks", [
      ["user_name", "VARCHAR(128) NULL"],
      ["title", "VARCHAR(191) NULL"],
      ["style", "VARCHAR(128) NULL"],
      ["progress", "INT NULL"],
      ["model", "VARCHAR(128) NULL"],
      ["poster_url", "TEXT NULL"],
      ["preview_type", "VARCHAR(64) NULL"],
      ["error_message", "TEXT NULL"],
      ["created_at_text", "VARCHAR(64) NULL"],
      ["finished_at_text", "VARCHAR(64) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_styles (
        id VARCHAR(64) PRIMARY KEY,
        name_key VARCHAR(191) NULL,
        name VARCHAR(191) NULL,
        image TEXT NULL,
        base_price DECIMAL(10,2) NULL,
        status VARCHAR(64) NULL,
        sort_order INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("shop_styles", [
      ["name", "VARCHAR(191) NULL"],
      ["image", "TEXT NULL"],
      ["status", "VARCHAR(64) NULL"],
      ["sort_order", "INT NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_fabrics (
        id VARCHAR(64) PRIMARY KEY,
        name_key VARCHAR(191) NULL,
        name VARCHAR(191) NULL,
        image TEXT NULL,
        composition TEXT NULL,
        weight VARCHAR(128) NULL,
        width VARCHAR(128) NULL,
        pantone VARCHAR(128) NULL,
        hex VARCHAR(32) NULL,
        rgb VARCHAR(64) NULL,
        price_markup DECIMAL(10,2) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("shop_fabrics", [
      ["name", "VARCHAR(191) NULL"],
      ["image", "TEXT NULL"],
      ["composition", "TEXT NULL"],
      ["weight", "VARCHAR(128) NULL"],
      ["width", "VARCHAR(128) NULL"],
      ["pantone", "VARCHAR(128) NULL"],
      ["hex", "VARCHAR(32) NULL"],
      ["rgb", "VARCHAR(64) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_preview_images (
        id VARCHAR(128) PRIMARY KEY,
        style_id VARCHAR(64) NOT NULL,
        fabric_id VARCHAR(64) NOT NULL,
        image_url TEXT NULL,
        oss_url TEXT NULL,
        oss_key TEXT NULL,
        visibility VARCHAR(32) NULL DEFAULT 'public',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_shop_preview_pair (style_id, fabric_id),
        INDEX idx_shop_preview_style_id (style_id),
        INDEX idx_shop_preview_fabric_id (fabric_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_orders (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        style_id VARCHAR(64) NULL,
        fabric_id VARCHAR(64) NULL,
        size VARCHAR(32) NULL,
        quantity INT NULL,
        unit_price DECIMAL(10,2) NULL,
        amount DECIMAL(10,2) NULL,
        status VARCHAR(64) NULL,
        payment_method VARCHAR(64) NULL,
        receiver_name VARCHAR(128) NULL,
        receiver_phone VARCHAR(64) NULL,
        receiver_email VARCHAR(191) NULL,
        receiver_address TEXT NULL,
        created_at_text VARCHAR(64) NULL,
        paid_at_text VARCHAR(64) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shop_orders_user_id (user_id),
        INDEX idx_shop_orders_status (status),
        INDEX idx_shop_orders_style_id (style_id),
        INDEX idx_shop_orders_fabric_id (fabric_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("shop_orders", [
      ["style_id", "VARCHAR(64) NULL"],
      ["fabric_id", "VARCHAR(64) NULL"],
      ["size", "VARCHAR(32) NULL"],
      ["quantity", "INT NULL"],
      ["unit_price", "DECIMAL(10,2) NULL"],
      ["payment_method", "VARCHAR(64) NULL"],
      ["receiver_name", "VARCHAR(128) NULL"],
      ["receiver_phone", "VARCHAR(64) NULL"],
      ["receiver_email", "VARCHAR(191) NULL"],
      ["receiver_address", "TEXT NULL"],
      ["created_at_text", "VARCHAR(64) NULL"],
      ["paid_at_text", "VARCHAR(64) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_reviews (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NULL,
        role VARCHAR(191) NULL,
        rating INT NULL,
        comment TEXT NULL,
        date_text VARCHAR(32) NULL,
        verified TINYINT(1) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("shop_reviews", [
      ["name", "VARCHAR(128) NULL"],
      ["role", "VARCHAR(191) NULL"],
      ["comment", "TEXT NULL"],
      ["date_text", "VARCHAR(32) NULL"]
    ]);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS runtime_config (
        config_key VARCHAR(64) PRIMARY KEY,
        active_provider VARCHAR(64) NULL,
        storage_active VARCHAR(64) NULL,
        video_provider VARCHAR(64) NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureColumns("runtime_config", [
      ["active_provider", "VARCHAR(64) NULL"],
      ["storage_active", "VARCHAR(64) NULL"],
      ["video_provider", "VARCHAR(64) NULL"]
    ]);

    await pool.query(`
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

    await pool.query(`
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

    await pool.query(`
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS migration_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        detail LONGTEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  function compactObject(item) {
    return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));
  }

  function mapUserRow(row) {
    return compactObject({
      id: row.id,
      name: row.name,
      nickName: row.nick_name,
      points: row.points,
      total: row.total,
      success: row.success,
      avatarUrl: row.avatar_url,
      avatar: row.avatar_url,
      unionid: row.unionid,
      miniOpenid: row.mini_openid,
      webOpenid: row.web_openid,
      lastCheckInDate: row.last_check_in_date
    });
  }

  function mapSessionRow(row) {
    return compactObject({
      token: row.token,
      userId: row.user_id,
      source: row.source,
      createdAt: row.created_at_ms,
      expiresAt: row.expires_at
    });
  }

  function mapAssetRow(row) {
    return compactObject({
      id: row.id,
      name: row.name,
      type: row.type,
      color: row.color,
      style: row.style,
      status: row.status,
      url: row.url,
      localUrl: row.local_url,
      ossUrl: row.oss_url,
      ossKey: row.oss_key,
      createdAt: row.created_at_text
    });
  }

  function mapTaskRow(row) {
    return compactObject({
      id: row.id,
      userId: row.user_id,
      user: row.user_name,
      mode: row.mode,
      status: row.status,
      progress: row.progress,
      points: row.points,
      provider: row.provider,
      model: row.model,
      personUrl: row.person_url,
      garmentUrl: row.garment_url,
      resultUrl: row.result_url,
      prompt: row.prompt,
      errorMessage: row.error_message,
      createdAt: row.created_at_text,
      finishedAt: row.finished_at_text
    });
  }

  function mapVideoRow(row) {
    return compactObject({
      id: row.id,
      userId: row.user_id,
      user: row.user_name,
      sourceTaskId: row.source_task_id,
      title: row.title,
      style: row.style,
      status: row.status,
      progress: row.progress,
      provider: row.provider,
      model: row.model,
      posterUrl: row.poster_url,
      videoUrl: row.video_url,
      previewType: row.preview_type,
      errorMessage: row.error_message,
      createdAt: row.created_at_text,
      finishedAt: row.finished_at_text
    });
  }

  function mapStyleRow(row) {
    return compactObject({
      id: row.id,
      nameKey: row.name_key,
      name: row.name,
      image: row.image,
      basePrice: row.base_price == null ? undefined : Number(row.base_price),
      status: row.status,
      sortOrder: row.sort_order
    });
  }

  function mapFabricRow(row) {
    return compactObject({
      id: row.id,
      nameKey: row.name_key,
      name: row.name,
      image: row.image,
      composition: row.composition,
      weight: row.weight,
      width: row.width,
      pantone: row.pantone,
      hex: row.hex,
      rgb: row.rgb,
      priceMarkup: row.price_markup == null ? undefined : Number(row.price_markup)
    });
  }

  function mapOrderRow(row) {
    const receiver = {
      fullName: row.receiver_name,
      phone: row.receiver_phone,
      email: row.receiver_email,
      address: row.receiver_address
    };
    return compactObject({
      id: row.id,
      userId: row.user_id,
      styleId: row.style_id,
      fabricId: row.fabric_id,
      size: row.size,
      quantity: row.quantity,
      unitPrice: row.unit_price == null ? undefined : Number(row.unit_price),
      amount: row.amount == null ? undefined : Number(row.amount),
      status: row.status,
      paymentMethod: row.payment_method,
      receiver,
      createdAt: row.created_at_text,
      paidAt: row.paid_at_text
    });
  }

  function mapReviewRow(row) {
    return compactObject({
      id: Number.isFinite(Number(row.id)) ? Number(row.id) : row.id,
      name: row.name,
      role: row.role,
      rating: row.rating,
      comment: row.comment,
      date: row.date_text,
      verified: row.verified == null ? undefined : Boolean(row.verified)
    });
  }

  function mapPreviewRow(row) {
    return compactObject({
      id: row.id,
      styleId: row.style_id,
      fabricId: row.fabric_id,
      imageUrl: row.image_url,
      ossUrl: row.oss_url,
      ossKey: row.oss_key,
      visibility: row.visibility
    });
  }

  function mapStorageConfig(row) {
    if (!row) return null;
    return compactObject({
      active: row.active,
      local: compactObject({
        baseUrl: row.local_base_url,
        note: row.local_note
      }),
      oss: compactObject({
        enabled: row.oss_enabled == null ? undefined : Boolean(row.oss_enabled),
        bucket: row.oss_bucket,
        region: row.oss_region,
        endpoint: row.oss_endpoint,
        publicBaseUrl: row.oss_public_base_url,
        accessKeyId: row.oss_access_key_id,
        accessKeySecret: row.oss_access_key_secret,
        note: row.oss_note
      })
    });
  }

  function mapVideoConfig(row) {
    if (!row) return null;
    return compactObject({
      activeProvider: row.active_provider,
      region: row.region,
      model: row.model,
      resolution: row.resolution,
      duration: row.duration,
      promptExtend: row.prompt_extend == null ? undefined : Boolean(row.prompt_extend),
      watermark: row.watermark == null ? undefined : Boolean(row.watermark),
      maxWaitSeconds: row.max_wait_seconds,
      mockDurationSeconds: row.mock_duration_seconds,
      note: row.note
    });
  }

  function mapProviderConfig(row) {
    return compactObject({
      enabled: row.enabled == null ? undefined : Boolean(row.enabled),
      apiKey: row.api_key,
      region: row.region,
      endpoint: row.endpoint,
      baseUrl: row.base_url,
      model: row.model,
      size: row.size,
      promptExtend: row.prompt_extend == null ? undefined : Boolean(row.prompt_extend),
      maxWaitSeconds: row.max_wait_seconds,
      videoEndpoint: row.video_endpoint,
      videoModel: row.video_model,
      threeDModel: row.three_d_model,
      videoResolution: row.video_resolution,
      videoDuration: row.video_duration,
      note: row.note
    });
  }

  function buildRuntimeConfig(configRow, storageRow, videoRow, providerRows) {
    if (!configRow && !storageRow && !videoRow && !providerRows.length) return null;
    const providers = {};
    for (const row of providerRows) providers[row.provider_key] = mapProviderConfig(row);
    return compactObject({
      activeProvider: configRow?.active_provider,
      storage: mapStorageConfig(storageRow),
      video: mapVideoConfig(videoRow),
      providers
    });
  }

  async function rows(table, mapper, order = "updated_at ASC") {
    const [items] = await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`);
    return items.map(mapper).filter(Boolean);
  }

  async function loadAll() {
    await initSchema();
    const [configRows] = await pool.query("SELECT * FROM runtime_config WHERE config_key = 'default' LIMIT 1");
    const [storageRows] = await pool.query("SELECT * FROM runtime_storage_config WHERE config_key = 'default' LIMIT 1");
    const [videoRows] = await pool.query("SELECT * FROM runtime_video_config WHERE config_key = 'default' LIMIT 1");
    const [providerRows] = await pool.query("SELECT * FROM runtime_provider_configs ORDER BY provider_key ASC");
    const [styles, fabrics, previews, users, userSessions, assets, tasks, videoTasks, shopOrders, shopReviews] = await Promise.all([
      rows("shop_styles", mapStyleRow),
      rows("shop_fabrics", mapFabricRow),
      rows("shop_preview_images", mapPreviewRow),
      rows("users", mapUserRow),
      rows("user_sessions", mapSessionRow),
      rows("assets", mapAssetRow),
      rows("generation_tasks", mapTaskRow),
      rows("video_tasks", mapVideoRow),
      rows("shop_orders", mapOrderRow),
      rows("shop_reviews", mapReviewRow)
    ]);
    if (previews.length) {
      for (const fabric of fabrics) {
        const matched = previews.filter((item) => item.fabricId === fabric.id || item.fabric_id === fabric.id);
        if (!matched.length) continue;
        fabric.previewUrls = fabric.previewUrls || {};
        for (const item of matched) {
          const styleId = item.styleId || item.style_id;
          const imageUrl = item.ossUrl || item.oss_url || item.imageUrl || item.image_url;
          if (styleId && imageUrl) fabric.previewUrls[styleId] = imageUrl;
        }
      }
    }
    return {
      runtimeConfig: buildRuntimeConfig(configRows[0], storageRows[0], videoRows[0], providerRows),
      shopProducts: styles.length || fabrics.length ? { styles, fabrics } : null,
      users,
      userSessions,
      assets,
      tasks,
      videoTasks,
      shopOrders,
      shopReviews
    };
  }

  function userValues(item) {
    return [
      text(item.id),
      optionalText(item.name),
      optionalText(item.nickName),
      numberOrNull(item.points),
      numberOrNull(item.total),
      numberOrNull(item.success),
      optionalText(item.avatarUrl || item.avatar),
      optionalText(item.unionid),
      optionalText(item.miniOpenid),
      optionalText(item.webOpenid),
      optionalText(item.lastCheckInDate)
    ];
  }

  function sessionValues(item) {
    return [
      text(item.token),
      text(item.userId),
      optionalText(item.source),
      numberOrNull(item.createdAt),
      numberOrNull(item.expiresAt)
    ];
  }

  function assetValues(item) {
    return [
      text(item.id),
      optionalText(item.name),
      optionalText(item.type),
      optionalText(item.color),
      optionalText(item.style),
      optionalText(item.status),
      optionalText(item.url),
      optionalText(item.localUrl),
      optionalText(item.ossUrl),
      optionalText(item.ossKey),
      optionalText(item.createdAt)
    ];
  }

  function taskValues(item) {
    return [
      text(item.id),
      optionalText(item.userId),
      optionalText(item.user),
      optionalText(item.mode),
      optionalText(item.status),
      numberOrNull(item.progress),
      numberOrNull(item.points),
      optionalText(item.provider),
      optionalText(firstOf(item, ["model", "modelName"])),
      optionalText(item.personUrl),
      optionalText(item.garmentUrl),
      optionalText(item.resultUrl),
      optionalText(item.prompt),
      optionalText(firstOf(item, ["error", "errorMessage", "failReason"])),
      optionalText(item.createdAt),
      optionalText(item.finishedAt)
    ];
  }

  function videoValues(item) {
    return [
      text(item.id),
      optionalText(item.userId),
      optionalText(item.user),
      optionalText(item.sourceTaskId),
      optionalText(item.title),
      optionalText(item.style),
      optionalText(item.status),
      numberOrNull(item.progress),
      optionalText(item.provider),
      optionalText(firstOf(item, ["model", "modelName"])),
      optionalText(item.posterUrl),
      optionalText(item.videoUrl),
      optionalText(item.previewType),
      optionalText(firstOf(item, ["error", "errorMessage", "failReason"])),
      optionalText(item.createdAt),
      optionalText(item.finishedAt)
    ];
  }

  function styleValues(item) {
    return [
      text(item.id),
      optionalText(item.nameKey),
      optionalText(item.name),
      optionalText(item.image),
      numberOrNull(item.basePrice),
      optionalText(item.status),
      numberOrNull(item.sortOrder)
    ];
  }

  function fabricValues(item) {
    return [
      text(item.id),
      optionalText(item.nameKey),
      optionalText(item.name),
      optionalText(item.image),
      optionalText(item.composition),
      optionalText(item.weight),
      optionalText(item.width),
      optionalText(item.pantone),
      optionalText(item.hex),
      optionalText(item.rgb),
      numberOrNull(item.priceMarkup)
    ];
  }

  function previewRowsFromShopProducts(shopProducts) {
    const rows = [];
    for (const fabric of shopProducts?.fabrics || []) {
      const previewUrls = fabric.previewUrls || {};
      for (const [styleId, imageUrl] of Object.entries(previewUrls)) {
        if (!styleId || !imageUrl) continue;
        rows.push({
          id: `${fabric.id}_${styleId}`,
          fabricId: fabric.id,
          styleId,
          imageUrl,
          ossUrl: /^https?:\/\//i.test(imageUrl) ? imageUrl : "",
          ossKey: "",
          visibility: "public"
        });
      }
    }
    return rows;
  }

  function orderValues(item) {
    const receiver = item.receiver || {};
    return [
      text(item.id),
      optionalText(item.userId),
      optionalText(item.styleId),
      optionalText(item.fabricId),
      optionalText(item.size),
      numberOrNull(item.quantity),
      numberOrNull(item.unitPrice),
      numberOrNull(item.amount),
      optionalText(item.status),
      optionalText(item.paymentMethod),
      optionalText(receiver.fullName || receiver.name),
      optionalText(receiver.phone),
      optionalText(receiver.email),
      optionalText(receiver.address),
      optionalText(item.createdAt),
      optionalText(item.paidAt)
    ];
  }

  function reviewValues(item) {
    return [
      text(item.id),
      optionalText(item.name),
      optionalText(item.role),
      numberOrNull(item.rating),
      optionalText(item.comment),
      optionalText(item.date),
      boolOrNull(item.verified)
    ];
  }

  function configValues(runtimeConfig) {
    return [
      "default",
      optionalText(runtimeConfig?.activeProvider),
      optionalText(runtimeConfig?.storage?.active),
      optionalText(runtimeConfig?.video?.activeProvider)
    ];
  }

  function storageValues(runtimeConfig) {
    const storage = runtimeConfig?.storage || {};
    const local = storage.local || {};
    const oss = storage.oss || {};
    return [
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
    ];
  }

  function videoConfigValues(runtimeConfig) {
    const video = runtimeConfig?.video || {};
    return [
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
    ];
  }

  function providerValues(providerKey, item) {
    return [
      text(providerKey),
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
    ];
  }

  async function saveRuntimeConfigWithConnection(conn, runtimeConfig) {
    await conn.query(
      "REPLACE INTO runtime_config (config_key, active_provider, storage_active, video_provider) VALUES (?, ?, ?, ?)",
      configValues(runtimeConfig)
    );
    await conn.query(
      "REPLACE INTO runtime_storage_config (config_key, active, local_base_url, local_note, oss_enabled, oss_bucket, oss_region, oss_endpoint, oss_public_base_url, oss_access_key_id, oss_access_key_secret, oss_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      storageValues(runtimeConfig)
    );
    await conn.query(
      "REPLACE INTO runtime_video_config (config_key, active_provider, region, model, resolution, duration, prompt_extend, watermark, max_wait_seconds, mock_duration_seconds, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      videoConfigValues(runtimeConfig)
    );
    await replaceRows(conn, "runtime_provider_configs", Object.entries(runtimeConfig?.providers || {}), async ([providerKey, item]) => {
      await conn.query(
        "INSERT INTO runtime_provider_configs (provider_key, enabled, api_key, region, endpoint, base_url, model, size, prompt_extend, max_wait_seconds, video_endpoint, video_model, three_d_model, video_resolution, video_duration, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        providerValues(providerKey, item || {})
      );
    });
  }

  async function saveAllWithConnection(conn, snapshot) {
    await replaceRows(conn, "users", snapshot.users || [], async (item) => {
      await conn.query(
        "INSERT INTO users (id, name, nick_name, points, total, success, avatar_url, unionid, mini_openid, web_openid, last_check_in_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        userValues(item)
      );
    });
    await replaceRows(conn, "user_sessions", snapshot.userSessions || [], async (item) => {
      await conn.query(
        "INSERT INTO user_sessions (token, user_id, source, created_at_ms, expires_at) VALUES (?, ?, ?, ?, ?)",
        sessionValues(item)
      );
    });
    await replaceRows(conn, "assets", snapshot.assets || [], async (item) => {
      await conn.query(
        "INSERT INTO assets (id, name, type, color, style, status, url, local_url, oss_url, oss_key, created_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        assetValues(item)
      );
    });
    await replaceRows(conn, "generation_tasks", snapshot.tasks || [], async (item) => {
      await conn.query(
        "INSERT INTO generation_tasks (id, user_id, user_name, mode, status, progress, points, provider, model, person_url, garment_url, result_url, prompt, error_message, created_at_text, finished_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        taskValues(item)
      );
    });
    await replaceRows(conn, "video_tasks", snapshot.videoTasks || [], async (item) => {
      await conn.query(
        "INSERT INTO video_tasks (id, user_id, user_name, source_task_id, title, style, status, progress, provider, model, poster_url, video_url, preview_type, error_message, created_at_text, finished_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        videoValues(item)
      );
    });
    await replaceRows(conn, "shop_styles", snapshot.shopProducts?.styles || [], async (item) => {
      await conn.query(
        "INSERT INTO shop_styles (id, name_key, name, image, base_price, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        styleValues(item)
      );
    });
    await replaceRows(conn, "shop_fabrics", snapshot.shopProducts?.fabrics || [], async (item) => {
      await conn.query(
        "INSERT INTO shop_fabrics (id, name_key, name, image, composition, weight, width, pantone, hex, rgb, price_markup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        fabricValues(item)
      );
    });
    await replaceRows(conn, "shop_preview_images", previewRowsFromShopProducts(snapshot.shopProducts), async (item) => {
      await conn.query(
        "INSERT INTO shop_preview_images (id, style_id, fabric_id, image_url, oss_url, oss_key, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.styleId, item.fabricId, item.imageUrl, item.ossUrl, item.ossKey, item.visibility]
      );
    });
    await replaceRows(conn, "shop_orders", snapshot.shopOrders || [], async (item) => {
      await conn.query(
        "INSERT INTO shop_orders (id, user_id, style_id, fabric_id, size, quantity, unit_price, amount, status, payment_method, receiver_name, receiver_phone, receiver_email, receiver_address, created_at_text, paid_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        orderValues(item)
      );
    });
    await replaceRows(conn, "shop_reviews", snapshot.shopReviews || [], async (item) => {
      await conn.query(
        "INSERT INTO shop_reviews (id, name, role, rating, comment, date_text, verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
        reviewValues(item)
      );
    });
    if (snapshot.runtimeConfig) {
      await saveRuntimeConfigWithConnection(conn, snapshot.runtimeConfig);
    }
  }

  async function persistAll(snapshot) {
    await initSchema();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await saveAllWithConnection(conn, snapshot);
      await conn.query("INSERT INTO migration_log (name, detail) VALUES (?, ?)", [
        "json-to-mysql-normalized",
        toJson({
          users: snapshot.users?.length || 0,
          userSessions: snapshot.userSessions?.length || 0,
          assets: snapshot.assets?.length || 0,
          tasks: snapshot.tasks?.length || 0,
          videoTasks: snapshot.videoTasks?.length || 0,
          shopStyles: snapshot.shopProducts?.styles?.length || 0,
          shopFabrics: snapshot.shopProducts?.fabrics?.length || 0,
          shopOrders: snapshot.shopOrders?.length || 0,
          shopReviews: snapshot.shopReviews?.length || 0
        })
      ]);
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  function persistLater(label, fn) {
    Promise.resolve()
      .then(fn)
      .catch((error) => console.warn(`MySQL 保存失败(${label}): ${error.message}`));
  }

  async function replaceTable(table, rowsToSave, mapper) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await replaceRows(conn, table, rowsToSave, (item) => mapper(conn, item));
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  const api = {
    enabled: true,
    pool,
    initSchema,
    loadAll,
    persistAll,
    close: () => pool.end(),
    saveRuntimeConfig: (runtimeConfig) => persistLater("runtime_config", async () => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await saveRuntimeConfigWithConnection(conn, runtimeConfig);
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }),
    saveUsers: (items) => persistLater("users", () =>
      replaceTable("users", items || [], (conn, item) =>
        conn.query(
          "INSERT INTO users (id, name, nick_name, points, total, success, avatar_url, unionid, mini_openid, web_openid, last_check_in_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          userValues(item)
        )
      )
    ),
    saveUserSessions: (items) => persistLater("user_sessions", () =>
      replaceTable("user_sessions", items || [], (conn, item) =>
        conn.query(
          "INSERT INTO user_sessions (token, user_id, source, created_at_ms, expires_at) VALUES (?, ?, ?, ?, ?)",
          sessionValues(item)
        )
      )
    ),
    saveAssets: (items) => persistLater("assets", () =>
      replaceTable("assets", items || [], (conn, item) =>
        conn.query(
          "INSERT INTO assets (id, name, type, color, style, status, url, local_url, oss_url, oss_key, created_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          assetValues(item)
        )
      )
    ),
    saveTasks: (items, videos) => persistLater("tasks", async () => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await replaceRows(conn, "generation_tasks", (items || []).filter((item) => !item.transient).slice(0, 500), async (item) => {
          await conn.query(
            "INSERT INTO generation_tasks (id, user_id, user_name, mode, status, progress, points, provider, model, person_url, garment_url, result_url, prompt, error_message, created_at_text, finished_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            taskValues(item)
          );
        });
        await replaceRows(conn, "video_tasks", (videos || []).filter((item) => !item.transient).slice(0, 500), async (item) => {
          await conn.query(
            "INSERT INTO video_tasks (id, user_id, user_name, source_task_id, title, style, status, progress, provider, model, poster_url, video_url, preview_type, error_message, created_at_text, finished_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            videoValues(item)
          );
        });
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }),
    saveShopProducts: (shopProducts) => persistLater("shop_products", async () => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await replaceRows(conn, "shop_styles", shopProducts?.styles || [], async (item) => {
          await conn.query(
            "INSERT INTO shop_styles (id, name_key, name, image, base_price, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            styleValues(item)
          );
        });
        await replaceRows(conn, "shop_fabrics", shopProducts?.fabrics || [], async (item) => {
          await conn.query(
            "INSERT INTO shop_fabrics (id, name_key, name, image, composition, weight, width, pantone, hex, rgb, price_markup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            fabricValues(item)
          );
        });
        await replaceRows(conn, "shop_preview_images", previewRowsFromShopProducts(shopProducts), async (item) => {
          await conn.query(
            "INSERT INTO shop_preview_images (id, style_id, fabric_id, image_url, oss_url, oss_key, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [item.id, item.styleId, item.fabricId, item.imageUrl, item.ossUrl, item.ossKey, item.visibility]
          );
        });
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }
    }),
    saveShopOrders: (items) => persistLater("shop_orders", () =>
      replaceTable("shop_orders", items || [], (conn, item) =>
        conn.query(
          "INSERT INTO shop_orders (id, user_id, style_id, fabric_id, size, quantity, unit_price, amount, status, payment_method, receiver_name, receiver_phone, receiver_email, receiver_address, created_at_text, paid_at_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          orderValues(item)
        )
      )
    ),
    saveShopReviews: (items) => persistLater("shop_reviews", () =>
      replaceTable("shop_reviews", items || [], (conn, item) =>
        conn.query(
          "INSERT INTO shop_reviews (id, name, role, rating, comment, date_text, verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
          reviewValues(item)
        )
      )
    )
  };

  await api.initSchema();
  return api;
}
