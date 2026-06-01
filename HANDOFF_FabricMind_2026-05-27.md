# FabricMind 项目交接文档

更新时间：2026-05-27  
工作区：`D:\wechat-projects`

## 1. 项目背景

FabricMind 目前是一个“AI 试衣 + 素材管理 + 生成记录 + 后续电商下单”的项目。

当前已有三块内容：

1. `fabric-mind`
   - 小程序源码
   - 管理后台
   - Node 本地后端
   - 图片/视频生成接口
   - OSS 配置能力
   - 管理端登录、用户、素材、任务、模型配置等功能

2. `paletteFusionNet`
   - 老师给的纺织/面料相关程序
   - 目前先不部署到服务器
   - 后续可能作为管理员本地工具，做面料识别、换色、素材生成，再上传到 OSS/素材库

3. `dianshang\电商前端`
   - 新增的电商前端
   - Next.js 15 + React 19 项目
   - 目前是前端交互原型，还没有真实电商后端

## 2. 当前目录结构

主要目录：

```text
D:\wechat-projects
  ├─ fabric-mind
  ├─ paletteFusionNet
  └─ dianshang
      └─ 电商前端
```

### `fabric-mind`

```text
fabric-mind/
  ├─ server/          Node 后端
  ├─ admin/           管理后台页面
  ├─ mobile/          浏览器端小程序预览
  ├─ miniprogram/     微信小程序源码
  ├─ public/          本地图片、视频、上传文件
  └─ docs/            项目说明文档
```

本地启动：

```powershell
cd D:\wechat-projects\fabric-mind
node server/index.js
```

本地默认端口：

```text
http://127.0.0.1:5177
```

主要入口：

```text
http://127.0.0.1:5177/mobile
http://127.0.0.1:5177/admin
http://127.0.0.1:5177/api/health
```

### `dianshang\电商前端`

目录：

```text
D:\wechat-projects\dianshang\电商前端
```

技术栈：

```text
Next.js 15
React 19
TypeScript
Tailwind CSS
shadcn/Radix UI
lucide-react
```

启动：

```powershell
cd D:\wechat-projects\dianshang\电商前端
npm run dev
```

默认端口通常是：

```text
http://127.0.0.1:3000
```

当前页面：

```text
/
/checkout
/reviews
```

当前电商前端逻辑：

- 首页可选择款式、面料、尺码。
- 预览图是写死路径拼接：

```text
/resources/kuanshi/fabricX_styleY.png
```

- 结算页读取 URL 参数：

```text
/checkout?style=tx&fabric=fabric1&size=M
```

- 支付是模拟弹窗。
- 订单没有真实入库。
- 没有真实支付。
- 没有真实商品 API。
- 没有和小程序用户体系打通。

资源规模：

```text
public/resources/fabric   17 张面料图
public/resources/style    4 张款式图
public/resources/kuanshi  68 张组合图
```

## 3. 服务器信息与操作约束

服务器连接优先使用：

```powershell
ssh fabricmind-server
```

备用：

```powershell
ssh admin@8.136.153.20
```

重要约束：

- 不要问用户要服务器密码、宝塔密码、数据库密码。
- 这台电脑已经配置 SSH 密钥。
- 连接服务器后先只读检查。
- 不要上来改防火墙、重启服务器、删文件。
- 如需改 Nginx，先备份配置并 `nginx -t` 检查。

服务器当前已知状态：

```text
服务器公网 IP：8.136.153.20
FabricMind 项目目录：/www/wwwroot/fabric-mind
FabricMind 后端端口：5177
Nginx：已运行
宝塔面板进程：运行中，但面板页面目前 404
```

服务器健康检查已验证：

```text
http://8.136.153.20/api/health
```

返回正常，说明 FabricMind 后端进程和 Nginx 代理基本可用。

## 4. 域名与 DNS 当前状态

域名：

```text
wtu-wet.cn
```

已在阿里云 DNS 添加 A 记录：

```text
@       A    8.136.153.20
www     A    8.136.153.20
api     A    8.136.153.20
admin   A    8.136.153.20
shop    A    8.136.153.20
fabric  A    8.136.153.20
```

服务器端解析已确认正常：

```text
wtu-wet.cn        -> 8.136.153.20
www.wtu-wet.cn    -> 8.136.153.20
api.wtu-wet.cn    -> 8.136.153.20
admin.wtu-wet.cn  -> 8.136.153.20
shop.wtu-wet.cn   -> 8.136.153.20
fabric.wtu-wet.cn -> 8.136.153.20
```

本地电脑可能有 DNS 缓存，短时间内可能解析不一致。

## 5. 已做过的 Nginx 配置

服务器上已有配置：

```text
/www/server/panel/vhost/nginx/fabric-mind.conf
```

已把下面域名加入 `server_name`：

```text
wtu-wet.cn
www.wtu-wet.cn
api.wtu-wet.cn
admin.wtu-wet.cn
fabric.wtu-wet.cn
8.136.153.20
_
```

当前代理目标：

```text
http://127.0.0.1:5177
```

当前 Nginx 配置效果：

```text
http://wtu-wet.cn/...        -> 5177
http://api.wtu-wet.cn/...    -> 5177
http://admin.wtu-wet.cn/...  -> 5177
http://fabric.wtu-wet.cn/... -> 5177
```

已验证：

```text
Host: api.wtu-wet.cn http://127.0.0.1/api/health
```

可返回 FabricMind 健康检查。

注意：

- 当前还没有配置 HTTPS。
- 浏览器显示“不安全”是正常的，因为现在还是 HTTP。
- 备案、DNS、域名认证不等于 SSL 证书。

## 6. 宝塔面板当前问题

用户尝试访问：

```text
https://8.136.153.20:1223/home
```

显示：

```text
404 Not Found
```

检查结果：

- 宝塔面板进程存在。
- `1223` 端口有监听。
- `/login`、`/home`、`/` 都返回 404。
- 执行过宝塔面板重启，仍然 404。
- 执行过取消域名访问限制、取消 IP 访问限制、关闭设备验证、关闭 UA 验证，仍然 404。
- 这不像 FabricMind 的 Nginx 配置导致，更像宝塔面板自身路由/配置/数据库状态异常。

建议下一步：

1. 先不要继续依赖宝塔面板。
2. 服务器部署、Nginx、证书可以优先通过 SSH 命令处理。
3. 后续如果必须恢复宝塔，再单独排查宝塔面板数据库、面板安全入口、面板版本修复。

不要在交接过程中暴露宝塔密码、服务器密码、数据库密码。

## 7. 当前 HTTPS 缺口

现在访问：

```text
http://wtu-wet.cn/admin/login
```

浏览器显示“不安全”，原因是没有 HTTPS 证书。

下一步需要申请 SSL 证书，建议覆盖：

```text
wtu-wet.cn
www.wtu-wet.cn
api.wtu-wet.cn
admin.wtu-wet.cn
```

可选后续覆盖：

```text
shop.wtu-wet.cn
fabric.wtu-wet.cn
```

建议方式：

- 如果宝塔恢复，可以用宝塔 SSL/Let's Encrypt。
- 如果宝塔不可用，可以用 SSH 命令申请证书并手工配置 Nginx。

正式小程序必须用 HTTPS，请求域名后续应配置为：

```text
https://api.wtu-wet.cn
```

## 8. 推荐域名规划

短期：

```text
wtu-wet.cn              当前 FabricMind 用户端/主页
www.wtu-wet.cn          跳转或同主站
api.wtu-wet.cn          小程序与管理端 API
admin.wtu-wet.cn        管理后台
```

后续：

```text
shop.wtu-wet.cn         电商前端
mall-api.wtu-wet.cn     电商后端 API
fabric.wtu-wet.cn       面料/老师模型相关入口
```

当前建议：

- `api/admin/wtu-wet.cn` 先走 `5177`。
- `shop.wtu-wet.cn` 等电商前端部署后走 `3000` 或独立服务。
- `mall-api.wtu-wet.cn` 等电商后端完成后再开放。

## 9. 电商后端需要做什么

目前只有电商前端，没有电商后端。下一阶段重点是补一个电商后端。

推荐能力：

### 商品与素材

```text
GET  /api/shop/products
GET  /api/shop/products/:id
POST /api/admin/shop/products
PATCH /api/admin/shop/products/:id
DELETE /api/admin/shop/products/:id
```

商品字段建议：

```json
{
  "id": "p001",
  "name": "定制短袖",
  "category": "上衣",
  "basePrice": 199,
  "status": "上架",
  "coverUrl": "OSS URL",
  "description": "商品说明"
}
```

### 面料与款式

```text
GET  /api/shop/fabrics
GET  /api/shop/styles
POST /api/admin/shop/fabrics
POST /api/admin/shop/styles
```

面料字段建议：

```json
{
  "id": "fabric1",
  "name": "经典蓝高密精梳棉",
  "composition": "100% 精梳棉",
  "weight": "220g/m2",
  "color": "蓝色",
  "hex": "#0F4C81",
  "imageUrl": "OSS URL",
  "priceMarkup": 0
}
```

### SKU/组合图

当前前端用写死图片：

```text
/resources/kuanshi/fabricX_styleY.png
```

后端应改为接口返回：

```text
GET /api/shop/preview?style=tx&fabric=fabric1
```

返回：

```json
{
  "styleId": "tx",
  "fabricId": "fabric1",
  "previewUrl": "OSS URL",
  "price": 349
}
```

### 订单

```text
POST /api/shop/orders
GET  /api/shop/orders/:id
GET  /api/me/shop/orders
GET  /api/admin/shop/orders
PATCH /api/admin/shop/orders/:id/status
DELETE /api/admin/shop/orders/:id
```

订单字段建议：

```json
{
  "id": "o001",
  "userId": "u001",
  "productId": "p001",
  "styleId": "tx",
  "fabricId": "fabric1",
  "size": "M",
  "quantity": 1,
  "amount": 349,
  "status": "pending_payment",
  "receiver": {
    "name": "张三",
    "phone": "13800000000",
    "address": "地址"
  },
  "createdAt": "2026-05-27 01:00:00"
}
```

### 支付

短期可先做模拟支付：

```text
POST /api/shop/orders/:id/pay/mock
```

后续再接微信支付/支付宝。

### 和 FabricMind 用户体系打通

不要再做一套完全孤立的用户系统。建议电商订单使用 FabricMind 当前用户 ID。

例如：

```text
FabricMind userId -> Shop order userId
```

小程序端、管理后台、电商前端看到的是同一批用户。

## 10. 电商前端需要改什么

当前 `dianshang\电商前端` 中的数据写死在：

```text
app/page.tsx
app/checkout/page.tsx
contexts/language-context.tsx
```

需要改造：

1. 把 `stylesList` 改为接口读取。
2. 把 `fabricsList` 改为接口读取。
3. 把 `renderingImagePath` 改为后端返回的 `previewUrl`。
4. 结算页提交真实订单。
5. 模拟支付成功后更新订单状态。
6. 下单成功后能在管理端看到订单。
7. 后续小程序能复用同一套订单接口。

## 11. 小程序需要怎么接

小程序目前在：

```text
D:\wechat-projects\fabric-mind\miniprogram
```

API 基础地址在：

```text
miniprogram/app.js
```

后续正式应改为：

```js
baseUrl: "https://api.wtu-wet.cn"
```

前提：

- HTTPS 配好。
- 微信小程序后台添加合法 request 域名：

```text
https://api.wtu-wet.cn
```

小程序电商入口建议：

1. 短期：新增“商城”页面，调用电商后端接口。
2. 中期：复用 FabricMind 用户信息，下单写入统一订单表。
3. 长期：AI 生成结果页可跳转到同款商品/定制下单。

## 12. 推荐下一步任务

交接给下一个模型或工程师后，建议按顺序做：

1. 不再纠结宝塔面板，先确认 SSH 可用。
2. 给 `wtu-wet.cn/api/admin` 配 HTTPS。
3. 把小程序正式 `baseUrl` 切到 `https://api.wtu-wet.cn`。
4. 新建电商后端模块：
   - 商品
   - 面料
   - 款式
   - 预览图
   - 订单
   - 支付状态
5. 改造 `dianshang\电商前端`，从写死数据改为接口驱动。
6. 增加管理后台电商管理页：
   - 商品管理
   - 面料管理
   - 订单管理
   - 用户订单记录
7. 部署电商前端到 `shop.wtu-wet.cn`。
8. 小程序增加商城入口并复用电商 API。

## 13. 给下一个模型的直接工作指令

请先阅读本交接文档，然后读取以下目录：

```text
D:\wechat-projects\fabric-mind
D:\wechat-projects\dianshang\电商前端
```

工作重点不是重新设计一套电商页面，而是 **基于用户已经给出的电商前端继续解析和对接**。

优先级：

1. 先完整阅读 `D:\wechat-projects\dianshang\电商前端`。
2. 理解当前电商前端的页面、字段、选择逻辑、下单流程、图片资源路径。
3. 根据这个前端现有交互，补一个可用的电商后端。
4. 再把前端从“写死数据”改成“后端接口驱动”。
5. 小程序不是第一步重做，后续基于这套前后端接口增加商城入口即可。

先不要部署，先完成本地开发：

1. 在 `fabric-mind/server/index.js` 或合适位置增加电商后端 API。
2. 增加本地 JSON 存储文件，例如：

```text
server/runtime-shop-products.json
server/runtime-shop-orders.json
```

3. 后端接口字段要尽量贴合现有电商前端，不要凭空换一套字段。
4. 给管理端增加电商管理能力。
5. 将 `dianshang\电商前端` 的写死商品/面料/订单逻辑改为调用后端接口。
6. 本地测试：

```text
商品列表
商品详情
选择款式/面料
创建订单
模拟支付
管理端查看订单
```

7. 测试通过后再考虑部署到服务器。

### 电商前端对接原则

当前电商前端已经有比较完整的页面骨架：

```text
app/page.tsx
app/checkout/page.tsx
app/reviews/page.tsx
components/navbar.tsx
components/footer.tsx
contexts/language-context.tsx
public/resources/
```

不要直接推翻这些页面。应先把里面的静态数组抽象成后端数据：

```text
stylesList       -> GET /api/shop/styles
fabricsList      -> GET /api/shop/fabrics
renderingImage   -> GET /api/shop/preview?styleId=xxx&fabricId=xxx
checkout submit  -> POST /api/shop/orders
mock payment     -> POST /api/shop/orders/:id/pay/mock
```

前端页面保留现有选择体验：

```text
选择款式
选择面料
选择尺码
查看预览图
填写收货信息
提交订单
模拟支付
订单完成
```

后端需要让这些流程真实写入数据，而不是只存在浏览器状态里。

### 小程序后续对接原则

小程序后续不需要单独做一套电商逻辑。应复用这套电商后端：

```text
GET  /api/shop/products
GET  /api/shop/styles
GET  /api/shop/fabrics
GET  /api/shop/preview
POST /api/shop/orders
GET  /api/me/shop/orders
```

小程序可以新增：

```text
商城首页
商品详情
面料/款式选择
订单确认
我的订单
```

小程序、网页电商前端、管理后台应该共享同一批商品、面料、款式和订单数据。

不要让小程序再写一套孤立商品库。

服务器可通过：

```powershell
ssh fabricmind-server
```

连接。连接后先只读检查，不要直接重启、防火墙改动、删除文件。

## 14. 当前风险点

1. 宝塔面板目前 404，暂时不要依赖宝塔。
2. HTTPS 未配置，浏览器会显示不安全。
3. 电商前端目前没有真实后端。
4. 电商订单还没有和 FabricMind 用户体系打通。
5. 真实支付未接入。
6. 小程序正式环境必须 HTTPS 和合法域名配置。
7. 所有图片/视频建议继续走 OSS，服务器只保存 URL 和状态。
