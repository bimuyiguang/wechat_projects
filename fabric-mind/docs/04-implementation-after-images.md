# UI 图片生成后的小程序落地说明

## 你接下来怎么操作

1. 用 `02-ui-image-generation-prompts.md` 里的提示词生成 UI 参考图。
2. 优先生成这些图：

```text
小程序首页 / 生成页
素材选择页
生成中页面
结果页
管理后台素材库
管理后台任务详情
```

3. 把你满意的图片发给 Codex。
4. Codex 根据图片拆页面结构、组件、样式和接口。
5. 再生成小程序框架和管理后台框架。

## 小程序框架建议

推荐目录：

```text
miniprogram
├─ app.js
├─ app.json
├─ app.wxss
├─ pages
│  ├─ generate
│  ├─ assets
│  ├─ task
│  ├─ result
│  └─ history
├─ components
│  ├─ image-picker
│  ├─ asset-card
│  ├─ mode-tabs
│  ├─ prompt-editor
│  └─ task-status
└─ utils
   ├─ api.js
   ├─ upload.js
   └─ config.js
```

## 后端接口建议

第一版接口：

```text
GET  /api/health
POST /api/uploads
GET  /api/assets
GET  /api/assets/:id
POST /api/generation/try-on
GET  /api/tasks/:id
GET  /api/me/history
```

管理后台接口：

```text
POST /api/admin/login
GET  /api/admin/assets
POST /api/admin/assets
PATCH /api/admin/assets/:id
GET  /api/admin/tasks
GET  /api/admin/tasks/:id
GET  /api/admin/results
```

## 生成任务流程

```text
用户选择人物图和服装图
        ↓
小程序上传图片
        ↓
后端上传 OSS
        ↓
后端创建 task
        ↓
后端调用 DashScope API
        ↓
小程序轮询 task 状态
        ↓
后端保存结果到 OSS
        ↓
小程序展示结果图
```

## 设计落地原则

小程序：

```text
第一屏直接可生成
图片选择要大且清楚
提示词要可编辑但不吓人
生成状态要明确
结果图要突出
```

管理后台：

```text
图片管理优先
任务排查优先
表格和筛选要清楚
不要做营销页
不要做复杂大屏
```

## 后续接老师模型的位置

老师的 `PaletteFusionNet` 后续接在这里：

```text
POST /api/palettefusion/recolor
```

但第一版先不接。

第一版先跑通：

```text
OSS + DashScope + 小程序 + 管理后台
```

