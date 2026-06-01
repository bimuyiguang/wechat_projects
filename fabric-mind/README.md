# FabricMind 本地 MVP

当前版本是本地 mock MVP，不连接真实 OSS、DashScope 或老师的 PaletteFusionNet 模型。

## 本地端口

```text
http://127.0.0.1:5177
```

入口：

```text
用户端手机预览：http://127.0.0.1:5177/mobile
管理后台：http://127.0.0.1:5177/admin
健康检查：http://127.0.0.1:5177/api/health
```

## 启动

```powershell
cd D:\wechat-projects\fabric-mind
node server/index.js
```

如果使用 npm：

```powershell
npm run dev
```

如果 PowerShell 阻止 npm.ps1，可以直接用 `node server/index.js`。

## 本地冒烟测试

服务启动后可以跑：

```powershell
cd D:\wechat-projects\fabric-mind
node scripts/smoke-test.mjs
```

测试覆盖：

```text
后端健康检查
用户端 / 管理端页面入口
素材接口和筛选
管理端用户、素材、任务、结果接口
模型配置接口和 key 隐私
上传 mock 接口
用户生成 mock 流程
管理端模型测试 mock 流程
小程序页面文件完整性
```

浏览器真实渲染检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/browser-smoke-test.ps1
```

## 当前包含

```text
server/        本地 mock 后端 API
mobile/        浏览器里的小程序用户端预览
admin/         浏览器里的管理后台
miniprogram/   微信开发者工具可打开的小程序源码
public/        本地示例图片
design-assets/ UI 参考图套包
docs/          项目说明和 UI 指令
```

## 已模拟的功能

用户端：

```text
首页 AI 生成
素材选择
生成中任务轮询
生成结果
历史记录
我的 / 积分
```

管理端：

```text
概览
素材库
用户管理
积分记录
用户图片
生成任务
结果图库
模型配置
设置
任务详情
```

## 生图模型配置

管理后台新增入口：

```text
http://127.0.0.1:5177/admin -> 模型配置
```

这里可以：

```text
切换当前生成引擎
保存 / 更换 DashScope API Key
选择区域、模型和输出尺寸
直接用示例人物图 + 服装图测试生成
```

Key 只保存在本地后端配置里，不会进入微信小程序端。

也可以在项目根目录新建 `.env`：

```text
DASHSCOPE_API_KEY=replace-with-your-dashscope-key
```

注意：

```text
.env
server/runtime-config.json
public/generated/
```

已经写入 `.gitignore`，不要提交真实 key。

## 微信开发者工具

打开目录：

```text
D:\wechat-projects\fabric-mind\miniprogram
```

开发阶段需要勾选：

```text
不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
```

小程序接口地址在：

```text
miniprogram/app.js
```

当前为：

```js
baseUrl: "http://127.0.0.1:5177"
```

## 后续接真实能力的位置

DashScope / 生图 API：

```text
POST /api/generation/try-on
```

管理端模型配置：

```text
GET  /api/admin/model-config
POST /api/admin/model-config
POST /api/admin/model-test
```

OSS 上传：

```text
POST /api/uploads
```

展示视频：

```text
POST /api/videos
GET  /api/videos/:id
GET  /api/me/videos
GET  /api/admin/videos
```

当前本地版的视频流程是：

```text
结果图生成完成 -> 点击“生成展示视频” -> 进入同一个任务等待页 -> 图片显示已完成，视频显示生成中 -> 完成后回到结果页展示图片 + MP4
```

正式上线建议把这些文件都放到 OSS：

```text
用户上传原图
素材库图片
AI 生成结果图
图生视频 MP4
```

服务器只保存任务状态、用户记录、OSS URL 和少量配置，不长期保存大文件。阿里云图生视频需要首帧图片是公网可访问 URL，所以生产环境应先把结果图上传 OSS，再把 OSS URL 传给视频模型。

本地后端已支持 OSS 直传：

```text
storage.active = oss 时，/api/uploads 会把本地图片上传到 OSS
DashScope 结果图下载后会优先上传到 OSS
DashScope 结果视频下载后会优先上传到 OSS
图生视频遇到本地首帧图时，会先上传到 OSS 再传给视频模型
```

OSS 密钥只保存在本地后端配置或环境变量中，不会返回给小程序端。

老师 PaletteFusionNet 换色模型后续可以新增：

```text
POST /api/palettefusion/recolor
```
