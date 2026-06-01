# FabricMind 综合交接文档

更新时间：2026-06-01  
代码仓库：<https://gitee.com/wangentong/fabric-mind.git>  
当前分支：`master`  
当前提交：`a7a6e5e chore: initialize FabricMind workspace`

## 1. 项目总览

FabricMind 当前是一个多端项目，核心由三部分组成：

```text
D:\wechat-projects
├─ fabric-mind\                 小程序后端、管理端、小程序源码
├─ dianshang\电商前端\           Next.js 电商前台
├─ paletteFusionNet\            Python/Tauri 本地面料换色探索项目
├─ README.md                    仓库总说明
├─ .env.example                 环境变量模板
└─ HANDOFF_*.md                 历史交接文档
```

线上服务器相关路径：

```text
/www/wwwroot/fabric-mind
/www/wwwroot/fabric-mind/shop-front
/www/server/panel/vhost/nginx/fabric-mind.conf
```

主要线上域名规划：

```text
https://shop.wtu-wet.cn      电商前台
https://api.wtu-wet.cn       后端 API
https://admin.wtu-wet.cn     管理端，或后端 /admin 路径
```

## 2. 当前已完成内容

### 2.1 主后端与管理端

目录：`D:\wechat-projects\fabric-mind`

已实现内容：

- Node.js 单体后端，入口：`fabric-mind/server/index.js`
- 管理端静态页面：`fabric-mind/admin/index.html`
- 管理端主逻辑：`fabric-mind/admin/main.js`
- 用户、生成记录、素材、视频、模型配置、电商订单等接口已有基础实现
- 微信统一登录/二维码登录相关接口已有实现
- 登录态基于用户 Session/Cookie/Bearer Token 混合支持
- 管理端已有账号密码登录、验证码、Token/Session 相关保护逻辑

本地启动：

```powershell
cd D:\wechat-projects\fabric-mind
npm run dev
```

默认本地端口：

```text
http://127.0.0.1:5177
http://127.0.0.1:5177/admin
```

### 2.2 微信小程序端

目录：`D:\wechat-projects\fabric-mind\miniprogram`

已实现内容：

- 小程序首页、生成页、历史页、结果页、我的页面
- 静默登录：`miniprogram/app.js`
- API 请求封装：`miniprogram/utils/api.js`
- 网页二维码登录确认页：`miniprogram/pages/auth/qr-login`
- 我的页面增加了网页扫码登录入口
- 支持使用小程序登录态确认网页端登录二维码

需要在微信开发者工具中打开：

```text
D:\wechat-projects\fabric-mind\miniprogram
```

### 2.3 电商前台

目录：`D:\wechat-projects\dianshang\电商前端`

已实现内容：

- Next.js 15 电商前台
- 首页选款式、选面料、进入下单
- 结算页填写姓名、电话、地址
- 与后端订单接口对接
- 已接入微信/小程序二维码登录流程
- 首页和结算页已改为动态页面，避免旧 HTML 静态缓存导致登录 UI 不刷新

本地启动：

```powershell
cd D:\wechat-projects\dianshang\电商前端
npm run dev
```

默认本地端口：

```text
http://127.0.0.1:3000
```

生产构建：

```powershell
cd D:\wechat-projects\dianshang\电商前端
npm run build
```

### 2.4 Python 面料换色探索项目

目录：`D:\wechat-projects\paletteFusionNet`

说明：

- 这是独立的 Python/Tauri 本地面料换色探索项目
- 当前建议先作为管理员本地能力，不直接强行并入线上生产链路
- 如果服务器 GPU/内存不足，不建议直接部署到线上
- 后续可做成“管理员本地处理后上传 OSS”的半自动流程

本地 Python 服务启动：

```powershell
cd D:\wechat-projects\paletteFusionNet\python-service
python server.py 5188
```

## 3. 仓库整理与推送状态

已完成：

- 已在 `D:\wechat-projects` 初始化 Git 仓库
- 已配置远端：

```text
origin https://gitee.com/wangentong/fabric-mind.git
```

- 已成功推送到 Gitee `master`
- 当前远端跟踪状态正常：

```text
master...origin/master
```

重要处理：

- 大体积图片、模型、运行时数据没有进 Git
- 真实密钥、SSH 私钥、OSS Secret、模型 API Key、微信 AppSecret 没有进 Git
- `.env.example` 只保留占位配置
- `runtime-*.json` 已排除，因为可能包含用户、会话、订单、模型配置和密钥

## 4. 为什么部分文件没有进 Git

以下类型故意不提交：

```text
.env
.env.*
*.pem
*.key
id_rsa
id_ed25519
node_modules
.next
dist
target
fabric-mind/server/runtime-*.json
fabric-mind/public/generated
fabric-mind/public/uploads
fabric-mind/public/videos
dianshang/电商前端/public/resources
fabric-mind/public/samples
fabric-mind/public/home
fabric-mind/design-assets
paletteFusionNet/src-tauri/resources
paletteFusionNet/python-service/models/*.pt
```

原因：

- 这些文件要么包含敏感信息，要么是运行时数据，要么是大图片/模型资源
- 之前推送 Gitee 时 pack 达到约 238MB，被远端断开
- 移除大资源后 pack 降到约 12.42MB，已成功推送
- 大资源应通过 OSS、服务器目录、资源包或部署脚本恢复，不应塞进 Git

## 5. 接手人需要的权限

不要把密码、私钥、OSS Secret、模型 Key 直接写进文档或仓库。

推荐交接方式：

1. 接手人提供自己的 SSH 公钥
2. 服务器管理员把公钥加入服务器 `~/.ssh/authorized_keys`
3. 接手人本机配置 SSH alias，例如：

```sshconfig
Host fabricmind-server
  HostName <服务器IP>
  User root
  IdentityFile ~/.ssh/<接手人的私钥>
```

4. 生产密钥放到服务器 `.env` 或宝塔环境变量，不提交 Git
5. OSS、微信、阿里云、火山引擎 Key 通过控制台重新授权或环境变量注入

接手人至少需要：

- Gitee 仓库读写权限
- 服务器 SSH 登录权限
- 宝塔面板权限，若需要改 Nginx/SSL/进程
- 阿里云 DNS/SSL/OSS 权限，若需要改域名、证书、资源存储
- 微信公众平台/小程序后台权限，若需要改合法域名、AppID、AppSecret

## 6. 环境变量与配置

参考根目录：

```text
D:\wechat-projects\.env.example
```

后端常用配置：

```text
PORT=5177
FABRICMIND_ADMIN_USERNAME=User
FABRICMIND_ADMIN_PASSWORD=change-me
FABRICMIND_ADMIN_SECRET=change-me
FABRICMIND_USER_SESSION_SECRET=change-me

DASHSCOPE_API_KEY=replace-with-your-dashscope-key
ARK_API_KEY=replace-with-your-volcengine-ark-key
VOLCENGINE_ARK_API_KEY=replace-with-your-volcengine-ark-key

ALI_OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
ALI_OSS_BUCKET=your-bucket
ALI_OSS_ACCESS_KEY_ID=replace-with-your-oss-access-key-id
ALI_OSS_ACCESS_KEY_SECRET=replace-with-your-oss-access-key-secret

WECHAT_MINI_APPID=replace-with-your-mini-appid
WECHAT_MINI_SECRET=replace-with-your-mini-secret
WECHAT_WEB_APPID=replace-with-your-web-appid
WECHAT_WEB_SECRET=replace-with-your-web-secret
```

生产环境必须改掉默认管理端密码和 Session Secret。

## 7. 线上部署基本流程

### 7.1 后端

```bash
ssh fabricmind-server
cd /www/wwwroot/fabric-mind
git pull origin master
npm install
node server/index.js
```

如果使用 PM2 或宝塔 Node 项目管理，应通过对应面板重启，不建议长期裸跑 `node server/index.js`。

### 7.2 电商前台

```bash
ssh fabricmind-server
cd /www/wwwroot/fabric-mind/shop-front
git pull origin master
npm install
npm run build
fuser -k 3000/tcp || true
nohup env NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000 > /www/wwwroot/fabric-mind/shop-front.log 2>&1 &
```

检查：

```bash
ss -lntp | grep :3000
tail -50 /www/wwwroot/fabric-mind/shop-front.log
```

### 7.3 Nginx

```bash
nginx -t
nginx -s reload
```

## 8. 当前重点缺陷

### 8.1 电商登录/下单流程仍需最终核验

用户明确要求：

- 在 `https://shop.wtu-wet.cn/` 首页点击“立即下单定制”时，未登录必须先拦截
- 未登录不能直接进入填写姓名地址页面
- 登录成功后保持 7 天左右
- 刷新页面、返回首页、再次点击下单，不应重复要求登录
- 结算页已经登录后，不应继续显示多余的“请登录/重新登录”干扰按钮
- 购买页只负责填写订单信息，登录强校验主要放在首页下单入口和结算页兜底

当前代码已有方向：

- 后端 Cookie 已设置 `Max-Age=604800`
- 生产域名 Cookie 应使用 `Domain=.wtu-wet.cn; Secure; HttpOnly; SameSite=Lax; Path=/`
- 首页和结算页已改为动态页面，避免缓存
- 首页已有 `handleBuyNow()` 校验 `/api/me`

仍需接手人实际浏览器验证：

1. 清空 `shop.wtu-wet.cn` 和 `api.wtu-wet.cn` Cookie
2. 打开 `https://shop.wtu-wet.cn/`
3. 点击首页“立即下单定制”
4. 应弹出微信/小程序登录框，不应直接进入 checkout
5. 小程序扫码确认后，网页应自动进入结算页
6. 刷新结算页，仍保持登录
7. 返回首页，再次点击下单，应直接进入结算页
8. 关闭浏览器重开，7 天内仍应登录

如果失败，优先检查：

- `api.wtu-wet.cn` 返回的 `Set-Cookie` 是否有 `Domain=.wtu-wet.cn`
- 前端 fetch 是否带 `credentials: "include"`
- Nginx 是否转发/保留 `Set-Cookie`
- 首页是否所有购买按钮都调用 `handleBuyNow()`，而不是直接 `router.push("/checkout")`
- 是否存在旧静态构建缓存

### 8.2 结算页登录 UI 应收敛

建议逻辑：

- 未登录：显示登录卡片和二维码
- 已登录：只显示用户状态小条，不显示醒目的登录按钮
- “重新登录/退出登录”放到较弱的用户菜单或小链接
- 下单表单中不要重复出现登录要求

### 8.3 资源恢复问题

因为大资源已移出 Git，部署新机器时需要恢复：

```text
dianshang/电商前端/public/resources
fabric-mind/public/samples
fabric-mind/public/home
fabric-mind/design-assets
paletteFusionNet/src-tauri/resources
```

可选方案：

- 从当前本机 `D:\wechat-projects` 拷贝
- 从服务器现有目录拷贝
- 上传到 OSS 后改为 URL 引用
- 做一个单独的资源压缩包，不进 Git

## 9. 后续建议任务清单

优先级 P0：

- 完成电商登录态 7 天持久化核验
- 修复首页下单未登录拦截
- 修复已登录后结算页仍提示登录的问题
- 用真实浏览器检查 Cookie、跳转、刷新、返回首页后的状态

优先级 P1：

- 管理端用户详情聚合小程序记录、电商订单、评价记录
- 管理端补充订单删除、状态流转、搜索筛选
- 管理端补充模型调用记录：用户、时间、模型供应商、图片/视频结果、失败原因
- 小程序历史页图片/视频预览和保存按钮继续做 UI 收敛

优先级 P2：

- 将图片/视频全部走 OSS URL，降低服务器带宽和磁盘压力
- Python 面料换色项目做管理员本地工具化
- 电商订单接入真实微信支付
- 支持小程序与网页订单统一用户画像

## 10. 验证命令

后端语法检查：

```powershell
cd D:\wechat-projects\fabric-mind
node --check server\index.js
```

电商前台构建：

```powershell
cd D:\wechat-projects\dianshang\电商前端
npm run build
```

Gitee 状态：

```powershell
cd D:\wechat-projects
git status --short --branch
git log --oneline -1
git remote -v
```

敏感信息基础扫描：

```powershell
cd D:\wechat-projects
git grep -n -E "(sk-[A-Za-z0-9]|LTAI|access-key-secret|ark-[A-Za-z0-9]|AppSecret)"
```

## 11. 接手人第一天建议操作

1. 克隆仓库：

```bash
git clone https://gitee.com/wangentong/fabric-mind.git
```

2. 根据 `.env.example` 创建本地 `.env`
3. 启动 `fabric-mind` 后端
4. 启动 `dianshang/电商前端`
5. 跑一次电商首页到结算页的登录/下单流程
6. 再跑一次小程序扫码确认网页登录流程
7. 对照第 8 节修复登录持久化和重复登录 UI
8. 最后部署到服务器，并用真实域名验证 Cookie

## 12. 关键原则

- 代码进 Git，密钥不进 Git
- 运行时数据不进 Git
- 大图片/模型不进 Git
- 用户登录态以服务端 Session/Cookie 为准
- 小程序、网页、电商订单最终都要归到同一个用户 ID
- 所有线上修复必须用真实域名验证，不只看 localhost
