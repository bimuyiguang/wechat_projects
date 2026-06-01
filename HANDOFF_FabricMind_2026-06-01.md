# FabricMind 项目交接文档

日期：2026-06-01  
交接范围：FabricMind 小程序、主后端、管理端、电商前端、线上部署链路。

## 1. 项目概览

FabricMind 当前由三部分组成：

1. 主项目：`D:\wechat-projects\fabric-mind`
   - Node.js 原生后端
   - 管理端静态页面
   - 微信小程序端
   - AI 换装、视频生成、素材、用户、任务、模型配置、电商 API 等接口

2. 电商前端：`D:\wechat-projects\dianshang\电商前端`
   - Next.js 15
   - 首页试衣选品
   - 微信登录拦截
   - 结算下单页面
   - 评价展示

3. Python 面料服务：`D:\wechat-projects\paletteFusionNet`
   - Flask/Python 服务
   - 当前主要用于面料/材料方向探索
   - 暂未深度并入线上小程序和电商闭环

## 2. 线上服务器与域名

优先使用当前电脑已配置的 SSH alias：

```bash
ssh fabricmind-server
```

如果 alias 不可用，服务器基础信息：

```text
服务器 IP：8.136.153.20
常用部署用户：admin
连接格式：ssh admin@8.136.153.20
```

线上路径：

```text
主项目：
/www/wwwroot/fabric-mind

电商前端：
/www/wwwroot/fabric-mind/shop-front

Nginx 配置：
/www/server/panel/vhost/nginx/fabric-mind.conf

电商前台：
https://shop.wtu-wet.cn/

API/后端：
https://api.wtu-wet.cn/

管理端：
https://admin.wtu-wet.cn/admin
```

不要把服务器密码、SSH 私钥、OSS Secret、模型 Key、微信 AppSecret 直接发给接手人。若接手人无 SSH 权限，应让他提供 SSH 公钥，再加入服务器 `authorized_keys`。

## 3. 当前已完成的核心能力

### 3.1 小程序/AI 换装主链路

- 用户上传人物图、服装图。
- 图片上传到 OSS，避免长期占用服务器磁盘和带宽。
- 后端调用模型生成换装结果。
- 支持生成记录、历史记录、结果查看。
- 已扩展图片生成、视频生成入口。
- 管理端可查看部分任务、素材、用户、模型配置。

### 3.2 模型配置

- 管理端已做模型配置方向扩展。
- 目标是支持阿里、火山等多供应商。
- 当前重点需求是：
  - 图片生成 720P
  - 视频生成 720P、5 秒
  - 记录每次调用的模型/供应商/任务状态

### 3.3 电商前端

- Next.js 15 前端已接入主后端 API。
- 首页可选择款式、面料、尺码。
- 点击“立即下单定制”会校验微信登录。
- 未登录时弹出小程序扫码/登录码。
- 登录成功后进入 `/checkout`。
- `/checkout` 未登录时只显示登录卡片，不显示收货表单。
- `/checkout` 已登录时只显示下单表单和微信关联状态。
- 已移除购买页已登录状态下的“重新登录”“打开登录码”“解除绑定”等干扰按钮。
- 登录 Cookie 当前设计为 `.wtu-wet.cn`，`HttpOnly + Secure`，约 7 天有效。

### 3.4 微信统一登录

当前实现的是第一阶段方案：

- 小程序静默登录。
- Web 端通过二维码 token 让小程序确认。
- 后端写入 `fm_user_session` Cookie。
- 小程序用户和 Web 电商订单通过用户记录关联。

注意：QR 登录 session 当前使用内存 Map，服务重启后未确认的 QR token 会失效，这是可接受的临时设计。

### 3.5 管理端

- 管理端有登录页和验证码。
- 管理端可查看用户、素材、任务、模型配置、电商订单等。
- 管理端仍属于轻量后台，不是完整 RBAC 权限系统。

## 4. 当前运行和部署方式

### 4.1 本地启动主后端

```powershell
cd D:\wechat-projects\fabric-mind
node server/index.js
```

默认端口：

```text
5177
```

### 4.2 本地启动电商前端

```powershell
cd D:\wechat-projects\dianshang\电商前端
npm run dev
```

默认端口：

```text
3000
```

### 4.3 线上重建电商前端

```bash
cd /www/wwwroot/fabric-mind/shop-front
npm run build
```

重启 Next 服务：

```bash
fuser -k 3000/tcp || true
nohup env NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000 > /www/wwwroot/fabric-mind/shop-front.log 2>&1 &
```

确认端口：

```bash
ss -lntp | grep :3000
```

### 4.4 修改 Nginx 后

```bash
sudo nginx -t
sudo nginx -s reload
```

注意：之前出现过 Nginx 全局 `proxy_cache` 导致首页旧页面一直命中的问题。若线上“明明部署了但页面没变”，优先检查：

```text
/www/server/nginx/conf/proxy.conf
/www/server/panel/vhost/nginx/fabric-mind.conf
/www/server/nginx/proxy_cache_dir
```

站点反代层需要关闭动态页面缓存。

## 5. 重要运行时文件

当前项目没有正式数据库，后端使用 `runtime-*.json` 作为临时持久化文件。这些文件不能随便删除。

常见文件类型：

```text
runtime-users.json              用户数据
runtime-user-sessions.json      用户登录会话
runtime-shop-products.json      电商商品/款式/面料
runtime-shop-orders.json        电商订单
runtime-shop-reviews.json       评价
runtime-generation-records.json AI 生成记录
runtime-videos.json             视频任务
```

这些文件本质上是临时数据库。后续上线稳定后，建议迁移到 MySQL/PostgreSQL，再淘汰文件持久化。

`.txt`、`.csv`、`.md` 等遗留文件不要直接删除。删除前先用搜索确认没有代码引用：

```powershell
cd D:\wechat-projects
Select-String -Path .\fabric-mind\**\* -Pattern "目标文件名" -Recurse
```

## 6. 当前已知缺陷

### 6.1 架构缺陷

- 后端 `server/index.js` 较大，多个业务堆在一个文件里，后续维护成本高。
- 缺少正式数据库，`runtime-*.json` 并发写入存在风险。
- 缺少统一日志系统，线上排障依赖 `console`、日志文件和手动测试。
- 缺少进程管理器，当前更偏向手动 `nohup` 启动，建议后续使用 PM2 或 systemd。

### 6.2 安全缺陷

- 管理端登录已经有验证码和 Cookie，但不是完整的企业级权限系统。
- 还没有细粒度角色权限，例如超级管理员、运营、客服、只读人员。
- 业务密钥需要彻底迁移到环境变量或服务器安全配置，不能继续散落在聊天记录或源码里。
- 需要检查所有上传接口的文件类型、大小、扩展名、MIME、内容安全。

### 6.3 登录和会话缺陷

- QR 登录 token 当前存在内存中，服务重启会失效。
- Mock 微信登录逻辑用于本地调试，正式环境应接真实微信 AppID、Secret、UnionID。
- Web 和小程序统一用户体系已打通基础流程，但仍需做更多真实设备测试。

### 6.4 电商缺陷

- 当前支付是 mock 支付，不是真实微信支付/支付宝支付。
- 订单状态流转还不完整，需要补充取消、退款、售后、发货单号、物流查询。
- 商品/面料/款式管理仍偏基础，后续需要更完整的 SKU、库存、价格、上下架、排序、图片管理。
- 评价系统需要审核状态、屏蔽、删除、追评。

### 6.5 AI 生成缺陷

- 多供应商模型配置还需要继续收敛。
- 管理端需要完整显示每次调用的供应商、模型、参数、耗时、费用估算、失败原因。
- 图片/视频生成失败后的重试、取消、超时处理不完整。
- 720P、5 秒视频策略需要统一写入配置，不应散落在代码里。

### 6.6 OSS/媒体缺陷

- OSS 上传、回显、管理已在使用方向上推进，但需要统一媒体表。
- 需要明确原图、服装图、结果图、视频、素材图的生命周期。
- 需要定期清理未使用临时文件，避免 OSS 成本失控。
- 管理端查看图片/视频的比例、预览、放大、下载仍需要继续优化。

### 6.7 前端和代码质量缺陷

- 部分源码中文曾出现乱码显示，后续维护时要统一 UTF-8。
- 电商前端已有构建验证，但缺少自动化端到端测试。
- 小程序端 UI 和按钮布局已多次调整，但还需用真实手机尺寸继续回归。
- 根目录和项目目录存在多个 Chrome 测试临时目录、截图、部署包，后续应整理归档。

## 7. 后续优先任务

优先级 P0：

1. 保证线上稳定启动。
   - 后端、前端用 PM2 或 systemd 管理。
   - 重启后自动恢复。
   - 日志路径固定。

2. 数据库迁移。
   - 把 `runtime-*.json` 迁移到 MySQL/PostgreSQL。
   - 用户、会话、订单、生成任务、素材、模型调用记录全部入库。

3. 登录闭环真实验证。
   - 小程序真实 AppID/Secret。
   - Web Cookie 跨 `shop.wtu-wet.cn`、`api.wtu-wet.cn` 保持 7 天。
   - 用户返回首页再下单不重复登录。

4. 生成任务记录完善。
   - 记录供应商、模型、参数、输入图、输出图、视频 URL、状态、失败原因、用户 ID。
   - 管理端可以按用户、状态、模型、时间筛选。

优先级 P1：

1. 电商订单完善。
   - 真实支付预留。
   - 订单状态流转。
   - 管理端订单筛选、删除、编辑、导出。

2. OSS 媒体中心。
   - 素材、用户上传、生成结果、视频统一管理。
   - 支持预览、复制 URL、删除、归档。

3. 管理端权限系统。
   - 管理员账号表。
   - 角色权限。
   - 登录日志。
   - 操作审计。

4. 小程序 UI 回归。
   - 首页上传按钮布局。
   - 历史详情图片/视频放大。
   - 保存视频。
   - 我的页面头像、昵称、签到。

优先级 P2：

1. Python 面料服务整合。
   - 管理端材料库增加“本地材料处理”入口。
   - 管理员本机运行 Python 服务。
   - 处理结果上传 OSS。
   - 最终回写主后端素材库。

2. 自动化测试。
   - 后端 API 测试。
   - 电商前端 E2E。
   - 小程序关键流程人工测试清单。

3. 成本和监控。
   - 模型调用成本统计。
   - OSS 流量和存储统计。
   - 失败任务报警。

## 8. 接手人操作规范

接手人改代码前必须先确认：

```bash
pwd
ls
```

改动前备份线上关键文件：

```bash
cp /www/wwwroot/fabric-mind/server/index.js /www/wwwroot/fabric-mind/server/index.js.bak-YYYYMMDD-HHMM
cp /www/server/panel/vhost/nginx/fabric-mind.conf /www/server/panel/vhost/nginx/fabric-mind.conf.bak-YYYYMMDD-HHMM
```

禁止操作：

```text
不要 git reset --hard
不要 rm -rf 项目目录
不要删除 runtime-*.json
不要覆盖用户上传文件
不要把密钥写进聊天
不要在未测试情况下直接重启线上服务
```

每次改完必须验证：

```text
1. npm run build 通过
2. 后端服务正常
3. https://shop.wtu-wet.cn/ 正常
4. 首页未登录点击“立即下单定制”会弹登录
5. 登录后进入 checkout
6. 返回首页再次点击下单不重复登录
7. https://shop.wtu-wet.cn/checkout 未登录时不显示收货表单
8. 已登录 checkout 不显示重新登录/解除绑定按钮
9. 管理端能打开
10. Nginx 没有继续缓存旧页面
```

## 9. 当前重点验收标准

当前最重要的用户体验标准：

```text
用户在 shop.wtu-wet.cn 首页选择款式、面料、尺码。
点击“立即下单定制”。
如果未登录，必须先微信/小程序登录。
登录后 7 天内不应重复登录。
登录后进入购买页，只填写收货信息和支付方式。
购买页不应再出现重新登录、打开登录码、解除绑定等干扰入口。
订单必须绑定当前微信用户，管理端能按用户归档查看。
```

## 10. 给下一个 AI/工程师的简短指令

```text
你接手 FabricMind 项目。请先阅读本交接文档，不要直接重构。

本地路径：
D:\wechat-projects\fabric-mind
D:\wechat-projects\dianshang\电商前端
D:\wechat-projects\paletteFusionNet

线上路径：
/www/wwwroot/fabric-mind
/www/wwwroot/fabric-mind/shop-front

优先使用：
ssh fabricmind-server

不要问我要服务器密码。如果当前电脑能 ssh 进去，直接使用已有 SSH alias。
如果不能进去，请提供 SSH 公钥，由我添加权限。

不要删除 runtime-*.json。
不要泄露或明文保存任何密钥。
每次修改后必须构建、部署、真实访问验证。
```

