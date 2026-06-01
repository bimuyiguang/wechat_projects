# FabricMind MySQL 迁移说明

## 迁移范围

本次迁移把原来 `server/runtime-*.json` 中的业务数据写入 MySQL：

| JSON 文件 | MySQL 表 | 内容 |
| --- | --- | --- |
| `runtime-users.json` | `users` | 小程序/网页统一用户、积分、头像、微信标识等 |
| `runtime-user-sessions.json` | `user_sessions` | 用户登录 token、过期时间 |
| `runtime-assets.json` + 内置素材 | `assets` | 管理端素材、素材 URL、OSS URL |
| `runtime-tasks.json.tasks` | `generation_tasks` | AI 图片生成任务、输入图、结果图、状态 |
| `runtime-tasks.json.videoTasks` | `video_tasks` | 视频生成任务、首帧、视频 URL、状态 |
| `runtime-shop-products.json.styles` | `shop_styles` | 电商款式、价格、图片 |
| `runtime-shop-products.json.fabrics` | `shop_fabrics` | 面料、成分、颜色、加价 |
| `runtime-shop-orders.json` | `shop_orders` | 电商订单、收货信息、金额、状态 |
| `runtime-shop-reviews.json` | `shop_reviews` | 买家评价 |
| `runtime-config.json` | `runtime_config` | 模型、OSS、视频、供应商配置 |

表中已经拆出核心业务字段，同时把完整原始对象保存到 `data` 字段。这样既能保持现有接口返回格式不变，也能让后台筛选、统计、搜索逐步改成直接查 SQL 列。

## 第二阶段：字段拆分状态

当前不是只把整个对象塞进 `data`。核心表已经拆出这些字段：

| 表 | 已拆出的主要字段 |
| --- | --- |
| `users` | `name`、`nick_name`、`points`、`total`、`success`、`avatar_url`、`unionid`、`mini_openid`、`web_openid`、`last_check_in_date` |
| `user_sessions` | `user_id`、`source`、`created_at_ms`、`expires_at` |
| `assets` | `name`、`type`、`color`、`style`、`status`、`url`、`local_url`、`oss_url`、`oss_key`、`created_at_text` |
| `generation_tasks` | `user_id`、`user_name`、`mode`、`status`、`progress`、`points`、`provider`、`model`、`person_url`、`garment_url`、`result_url`、`prompt`、`error_message` |
| `video_tasks` | `user_id`、`source_task_id`、`title`、`style`、`status`、`progress`、`provider`、`model`、`poster_url`、`video_url` |
| `shop_styles` | `name_key`、`name`、`image`、`base_price`、`status`、`sort_order` |
| `shop_fabrics` | `name_key`、`name`、`image`、`composition`、`weight`、`width`、`pantone`、`hex`、`rgb`、`price_markup` |
| `shop_preview_images` | `style_id`、`fabric_id`、`image_url`、`oss_url`、`oss_key`、`visibility` |
| `shop_orders` | `user_id`、`style_id`、`fabric_id`、`size`、`quantity`、`unit_price`、`amount`、`status`、`payment_method`、收货人字段 |
| `shop_reviews` | `name`、`role`、`rating`、`comment`、`date_text`、`verified` |

`data` 字段目前作为兼容备份保留，避免一次性改动前端和小程序接口。当前后端读取 MySQL 时已经优先使用拆分列组装对象，`data` 只用于补充尚未拆出的兼容字段。

暂时不要删除 `data`。可以删除它的条件是：

1. 所有接口需要的字段都已经拆成独立列。
2. 后端读取、写入、筛选都不再依赖 `data`。
3. 管理端、小程序、电商前端完整回归通过。
4. 线上备份已经确认可恢复。

## 执行方式

确认 `fabric-mind/.env` 已配置：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=fabricmind
MYSQL_USER=your-user
MYSQL_PASSWORD=your-password
```

安装依赖后执行：

```powershell
npm run db:migrate
```

迁移脚本会自动创建数据库和表，并把当前 JSON 数据导入 MySQL。

## 迁移后的运行状态

后端启动时，如果 `.env` 里有完整 MySQL 配置：

1. 自动连接 MySQL。
2. 自动创建缺失的数据表。
3. 从 MySQL 读取用户、会话、素材、任务、订单、评价、配置。
4. 接口运行时仍使用内存缓存，写入时同时保存到 JSON 和 MySQL。

JSON 文件暂时保留为本地备份，不会删除。等线上稳定后，可以再把 JSON 写入关闭，改成纯 MySQL。

## 图片和视频如何放 OSS

MySQL 只存元数据，不存图片/视频二进制。

当前已经增加统一媒体记录表：

```text
media_files
```

它记录每个媒体文件的归属、字段名、原本地路径、OSS key、公网地址、公开/私有分类和文件大小。业务表中的常用图片字段也已回写为 OSS 地址。

推荐存放方式：

| 文件类型 | OSS 建议目录 | 访问方式 |
| --- | --- | --- |
| 商品图、公开面料图 | `public/products/`、`public/fabrics/` | 可公共读或 CDN |
| 用户上传人物图 | `private/users/{userId}/` | 私有读，后端签名 URL |
| 用户上传服装图 | `private/uploads/{userId}/` | 私有读，后端签名 URL |
| AI 生成结果图 | `private/results/{taskId}/` | 默认私有读 |
| 展示视频 | `private/videos/{taskId}/` 或 `public/videos/` | 个人结果私有，公开案例公共 |

数据库保存：

```text
url        前端可显示的路径，可能是本地路径或 OSS/CDN URL
ossUrl     OSS 公网 URL 或签名 URL
ossKey     OSS 对象 key，例如 private/results/t-xxx/result.png
userId     归属用户
taskId     归属生成任务
status     上传/生成状态
```

正式上线建议 Bucket 默认私有读写，公开商品素材单独放公共目录或公共 Bucket。用户人像和 AI 结果图不要长期使用公共读 URL。
## 当前最终状态

现在数据库已经不再依赖通用 `data` 字段。业务数据、媒体地址和运行配置都拆成了明确字段。

配置拆分后的表：

| 表 | 内容 |
| --- | --- |
| `runtime_config` | 当前图片模型供应商、当前存储方式、当前视频供应商 |
| `runtime_storage_config` | 本地/OSS 存储配置，包括 bucket、region、endpoint、publicBaseUrl、accessKey |
| `runtime_video_config` | 视频模型配置，包括模型、分辨率、时长、等待时间 |
| `runtime_provider_configs` | 各模型供应商配置，包括 dashscope、dashscopeTryOn、openai、doubao、mock |

当前所有业务表、配置表、媒体索引表都已经移除 `data` 字段。后端启动时从拆分字段组装运行对象，保存时也只写拆分字段。

保留的本地文件只用于开发样例或备份：

| 路径 | 说明 |
| --- | --- |
| `fabric-mind/backups/` | MySQL 和本地历史媒体备份，已加入 `.gitignore` |
| `fabric-mind/public/uploads/black-top-gray-pants.png` | 本地开发样例 |
| `fabric-mind/public/uploads/runway-person.png` | 本地开发样例 |

用户新上传图片时，OSS 可用则直接上传 OSS，数据库保存 OSS 地址，不再额外保存本地副本。
