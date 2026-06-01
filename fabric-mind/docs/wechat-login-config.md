# FabricMind 微信统一登录系统 — 部署与微信后台配置指南

本篇文档旨在指导运维与开发人员如何在真实上线前配置微信平台（小程序后台及微信开放平台）以打通 UnionID 多端登录合并。

---

## 1. 后端环境变量配置 (`.env` 或系统环境变量)

后端服务器已支持零宕机 Mock 与真实配置自适应机制。当配置了以下密钥后，系统会自动向微信官方接口发起请求；否则自动降级为 Mock Dev 本地闭环模式。

请在后端服务器根目录下创建或编辑 `.env` 文件：

```env
# ==============================================================================
# FabricMind 微信统一登录官方环境配置
# ==============================================================================

# 1. 微信小程序凭证 (用于小程序静默登录 code2Session)
WECHAT_MINI_APPID=wx_your_mini_appid
WECHAT_MINI_SECRET=your_mini_secret_key

# 2. 微信开放平台网站应用凭证 (用于电商网页端扫码登录)
WECHAT_WEB_APPID=wx_your_web_appid
WECHAT_WEB_SECRET=your_web_secret_key

# 3. 网页授权回调物理地址 (必须与开放平台配置的回调域名一致，必须使用 HTTPS 且路径匹配)
WECHAT_WEB_REDIRECT_URI=https://api.wtu-wet.cn/api/auth/wechat/web-callback

# 4. 电商前端首页地址 (用于微信扫码登录成功后重定向)
WECHAT_WEB_FRONTEND_URL=https://shop.wtu-wet.cn

# 5. 后端会话签名安全密钥 (推荐生成随机长字串，保障会话安全)
FABRICMIND_USER_SESSION_SECRET=fabricmind_secure_session_secret_uuid_random_str
```

---

## 2. 微信小程序后台配置 (mp.weixin.qq.com)

为保障微信小程序在真机或线上环境中顺利与主后端进行通信，必须在**小程序后台 -> 开发 -> 开发管理 -> 开发设置 -> 服务器域名**中补全以下配置：

1. **request 合法域名**：
   * 必须添加：`https://api.wtu-wet.cn`
   * （如小程序有直连主域名，也可添加：`https://wtu-wet.cn`）
2. **downloadFile 合法域名 / uploadFile 合法域名**：
   * 如有上传图片或下载素材需求，配置相应的 CDN 域名 or 后端域名（例如 `https://api.wtu-wet.cn`）。

> [!IMPORTANT]
> 线上真机环境**强制要求使用 HTTPS**，小程序客户端会自动根据版本环境判定 `baseUrl`（本地开发自动连接 `http://127.0.0.1:5177`，真机/体验版/正式版自适应切换至 `https://api.wtu-wet.cn`）。

---

## 3. 微信开放平台配置 (open.weixin.qq.com)

这是小程序与网页端实现 **UnionID 统一打通、合并用户**的最核心前置步骤！

### 3.1 绑定小程序
1. 登录微信开放平台。
2. 进入 **管理中心 -> 小程序**。
3. 点击 **绑定小程序**，按照步骤输入小程序的 AppID 并完成管理员扫码授权绑定。

### 3.2 创建网站应用 (获取网页扫码登录凭证)
1. 进入 **管理中心 -> 网站应用**。
2. 点击 **创建网站应用**，填写基本信息。
3. **网站授权回调域名** 必须配置为：
   * `api.wtu-wet.cn` 或 `shop.wtu-wet.cn` (请确保填写的是**纯域名**，不要包含 `http://` 或 `https://`，例如：`api.wtu-wet.cn`)。
4. 提交审核。审核通过后，即可获取到专有的 `WECHAT_WEB_APPID` 与 `WECHAT_WEB_SECRET`。

> [!NOTE]
> 只有当小程序和网站应用绑定在**同一个微信开放平台主体账号下**时，微信接口返回的 `unionid` 才会一致，系统也才能自动将两端同一人无缝合并。

---

## 4. 后端及线上部署核验步骤

1. **同步代码**：部署最新修改的 `server/index.js` 及电商前端与小程序代码。
2. **注入环境变量**：确保系统环境变量或根目录下 `.env` 已按照上方配置。
3. **健康检查验证**：
   * 访问 `https://api.wtu-wet.cn/api/health` 确保后端工作正常且为 HTTPS。
4. **测试流程**：
   * 微信开发者工具打开小程序，清除缓存，真机预览：应静默登录成功，可在管理后台查看到拥有 `miniOpenid` 和 `unionid` 的用户记录。
   * 访问 `https://shop.wtu-wet.cn/checkout`，点击微信登录，应顺利展示网页扫码界面，扫码后自动回到结算页，并且用户记录完美和刚才的小程序账号合二为一，订单归属一致！
