# FabricMind 微信统一登录与 QR 扫码上线部署建议指南 🚀

本指南旨在协助运维与研发团队，安全、平稳地将包含“微信统一登录（小程序静默登录与 UnionID 自动合并）”及“QR 网页扫码登录功能”的代码发布部署至线上生产环境。

---

## 📋 1. 需要同步到服务器的文件列表

在部署时，需将以下修改过的核心代码同步至线上服务器中对应的路径下：

### 后端服务端 (`fabric-mind/server/`)
* **[`server/index.js`](file:///d:/wechat-projects/fabric-mind/server/index.js)**: 后端核心服务，包含 QR create/status/confirm API 接口、重构后的 CORS Credentials 支持、安全 Set-Cookie 植入及 User 动态合并逻辑。

### 微信小程序 (`fabric-mind/miniprogram/`)
* **[`miniprogram/app.json`](file:///d:/wechat-projects/fabric-mind/miniprogram/app.json)**: 包含首屏默认首页调整，确保 `pages/generate/index` 处于首位，`pages/auth/qr-login/index` 处于末尾。
* **[`miniprogram/app.js`](file:///d:/wechat-projects/fabric-mind/miniprogram/app.js)**: 包含自适应环境切换逻辑 (`ENV_MODE = "auto"`)。
* **[`miniprogram/utils/api.js`](file:///d:/wechat-projects/fabric-mind/miniprogram/utils/api.js)**: 接口层拦截逻辑，修复了 message 自定义字段误判 Bug。
* **[`miniprogram/pages/auth/qr-login/`](file:///d:/wechat-projects/fabric-mind/miniprogram/pages/auth/qr-login/)**: 整个扫码确认登录页目录（含 `.js`, `.wxml`, `.wxss`, `.json`）。
* **[`miniprogram/pages/profile/`](file:///d:/wechat-projects/fabric-mind/miniprogram/pages/profile/)**: 用户个人中心，包含新增的“手机网页扫码登录”入口按钮。

### 电商前台 (`dianshang/电商前端/`)
* **[`app/checkout/page.tsx`](file:///d:/wechat-projects/dianshang/%E7%94%B5%E5%95%86%E5%89%8D%E7%AB%AF/app/checkout/page.tsx)**: 网页结算下单结算页面，新增“小程序扫码登录”登录墙通道、qrToken 生成、2.5 秒轮询控制及 Cookie 会话处理。
* **[`lib/api.ts`](file:///d:/wechat-projects/dianshang/%E7%94%B5%E5%95%86%E5%89%8D%E7%AB%AF/lib/api.ts)**: 前端通用 API 层，包含跨域 credentials 携带选项。

### 管理端 (`fabric-mind/admin/`)
* **[`admin/main.js`](file:///d:/wechat-projects/fabric-mind/admin/main.js)**: 后台管理核心逻辑，包含下单用户列图像匹配和详情面板多端业务联动展示。

---

## ⚙️ 2. 服务器部署步骤

线上后端服务通常运行在 PM2 或 systemd 后台守护下。

### 第一步：上传并分发文件
将上述需要同步的文件通过 Git、Rsync 或 SFTP 分发上传到生产服务器指定的工作目录。

### 第二步：重启后端 Node 服务 (占用端口 5177)
```bash
# 登录服务器后进入服务端根目录
cd /www/wwwroot/fabric-mind

# 查看当前运行的服务状态与名称
pm2 status

# 采用优雅热重启（无缝过渡，不中断现有用户连接）
pm2 reload fabric-mind-server

# 如果没有采用 PM2，常规物理重启：
# find port 5177 process and kill it, then restart
kill -9 $(lsof -t -i:5177)
nohup node server/index.js > server.log 2>&1 &
```

### 第三步：重新编译并启动电商前端 (占用端口 3000)
```bash
# 登录电商前端目录
cd /www/wwwroot/dianshang/电商前端

# 安装依赖（若有新增）
npm install

# 进行 Next.js 生产环境打包构建
npm run build

# 重启 PM2 挂载的 Next.js 服务
pm2 restart dianshang-frontend
```

### 第四步：核验端口与 HTTPS 反向代理 (端口 5177 / 3000 / 443)
```bash
# 确认 5177 与 3000 端口处于监听状态
netstat -tlnp | grep -E "5177|3000"

# 检查 Nginx HTTPS (443) 代理证书与响应状态
curl -I https://api.wtu-wet.cn/api/health
curl -I https://shop.wtu-wet.cn/checkout
```

---

## 📱 3. 小程序配置与真机版本管理

1. 打开 **微信开发者工具**，载入 `miniprogram` 项目。
2. 确认 `miniprogram/app.js` 中的 `ENV_MODE = "auto"`。在此模式下，当开发者工具调试时会自动路由至本地开发端口；一旦上传并在真机打开时，会自动根据环境（体验版/正式版）自适应路由至线上安全域名 `https://api.wtu-wet.cn`。
3. 点击开发者工具右上角的 **“上传”** 按钮，填写版本号（如 `1.1.0`）与备注“统一登录扫码上线稳定版”。
4. 上传成功后，登录 [微信公众平台 (小程序后台)](https://mp.weixin.qq.com/)：
   * 进入 **版本管理** -> **开发版本**。
   * 将刚刚上传的开发版本设为 **“体验版”**，并生成体验版二维码。
   * 安排测试人员扫码，进行真机测试。

### 微信公众平台服务器域名配置：
为确保真机小程序可以正常跨域发起网络请求，必须配置合法域名：
1. 登录小程序后台，进入 **开发** -> **开发管理** -> **开发设置** -> **服务器域名**。
2. 在 **request 合法域名** 中，添加线上 API 域名：
   * `https://api.wtu-wet.cn`

---

## 🧪 4. 线上环境真实回归验证步骤

线上部署完成后，请按照以下步骤进行完整闭环回归测试：

1. **测试 A：接口状态健康核验**
   * 访问：`https://api.wtu-wet.cn/api/health`（或 `/api/shop/styles`）确认接口畅通返回 JSON 数据。

2. **测试 B：电商前台网页加载**
   * 打开 `https://shop.wtu-wet.cn/checkout` 确认结算页面已展示，且在未登录状态下正确弹出统一微信登录墙。

3. **测试 C：生成小程序登录码 (QR Create)**
   * 点击网页端微信登录墙中的“生成小程序登录码”按钮。
   * 确认前端页面正常调用 `/api/auth/qr/create` 成功生成并渲染出 `qr-xxxx` 格式 of 短登录码，页面变为“等待小程序确认...”的 2.5 秒轮询状态。

4. **测试 D：小程序端确认登录 (QR Confirm)**
   * 真机扫码或在小程序体验版中进入 **“我的”** -> **“网页扫码登录”** 入口。
   * 输入或粘贴网页端显示的 `qr-xxxx` 登录码，点击“确认登录”。
   * 确认小程序端收到“确认成功”提示并自动退回。

5. **测试 E：网页轮询 confirmed 与 Cookie 写入 (QR Status & Set-Cookie)**
   * 观察网页端在小程序确认后，是否在 2.5 秒内自动更新为 confirmed。
   * 检查浏览器 Cookie，确认 `fm_user_session` Cookie 已成功写入当前 host (`shop.wtu-wet.cn`)。
   * **核验 Cookie 安全属性**：Set-Cookie 的值必须包含 `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`。

6. **测试 F：登录态拉取与下单联动 (/api/me & Checkout)**
   * 确认网页端自动通过 `GET /api/me` 读取出已合并的小程序用户信息。
   * 填写收件信息提交订单，确认订单中 `userId` 与刚才扫码用户一致。
   * 登录管理后台 `https://admin.wtu-wet.cn/admin/login`，在“用户管理”详情与“订单管理”列表中核验新提交订单，以及用户微信头像、昵称展示是否完全一致且能看到该笔电商订单。

---

## ↩️ 5. 紧急回滚方案

如果在部署或测试过程中发现突发性阻断故障，请立即采取回退步骤以确保线上业务不中断：

### 1. 后端回滚：
```bash
cd /www/wwwroot/fabric-mind
# 恢复备份的 server/index.js（建议在部署前备份原 index.js 命名为 index.js.bak）
mv server/index.js.bak server/index.js
pm2 reload fabric-mind-server
```

### 2. 小程序回滚：
* 线上小程序可在微信公众平台的版本管理中，选择“回退到上一个线上版本”，即可无缝且瞬间完成真机端回滚，无需重新提交审核。
* 对于体验版，直接让测试人员扫旧版体验码即可。

### 3. 电商前端回滚：
```bash
cd /www/wwwroot/dianshang/电商前端
# 如果使用 git 管理，直接 reset 并重新 build
git reset --hard HEAD~1
npm run build
pm2 restart dianshang-frontend
```

### 4. 脏数据与临时会话清理：
* 重启后端服务时，内存中未完成的 `global.qrLoginSessions` 临时 Map 会自动清空，天然防止过期 Token 留存；
* 测试阶段产生的脏订单可通过管理后台的“电商订单”列表点击“删除”进行物理擦除，保持数据库干净。
