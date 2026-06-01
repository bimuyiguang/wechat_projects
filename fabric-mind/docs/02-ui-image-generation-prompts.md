# FabricMind UI 参考图生成提示词

这些提示词用于网页端生图工具，先生成小程序和后台的视觉参考图。生成后把图片发给 Codex，再根据图片做真实小程序框架。

## 总体视觉方向

关键词：

```text
AI fashion try-on, fabric design, clean Chinese mobile app UI, premium but practical, light background, soft gray, black text, subtle blue accent, image-first interface, elegant product grid, modern WeChat mini program
```

不要做成花哨营销页，要像一个真正能用的工具。

## 小程序首页 / 生成页

中文提示词：

```text
设计一个微信小程序首页界面，产品名为 FabricMind，功能是 AI 试衣和服装图片生成。界面顶部是简洁标题和历史记录入口，中间有两个大上传区域：人物图和服装图。人物图区域显示“上传人物照片 / 从模特库选择”，服装图区域显示“选择衣服素材 / 上传衣服图片”。下面是生成模式分段按钮：上衣试穿、下装试穿、整套换装、自定义编辑。再下面是提示词输入框，默认文字为“保持脸部和背景不变，让服装自然贴合身体”。底部是醒目的“开始生成”按钮。整体是高级、干净、移动端工具型 UI，浅色背景，图片卡片为主，圆角适中，不要卡通，不要过度渐变。
```

英文提示词：

```text
Design a WeChat mini program home screen for an AI fashion try-on product named FabricMind. Clean mobile utility UI, light background, premium fashion technology feeling. The top area has the app title and a history icon. The main screen has two large image upload panels: person image and garment image. Add mode segmented controls: upper garment try-on, bottom try-on, full outfit, custom edit. Add a prompt input field with a short Chinese placeholder. At the bottom, a primary button says 开始生成. Use image-first layout, soft gray cards, black text, subtle blue accent, realistic app UI, not a landing page.
```

## 小程序素材选择页

中文提示词：

```text
设计一个微信小程序素材选择页面，用于选择服装素材。顶部有搜索框和分类标签：全部、上衣、裤子、裙子、整套、面料。主体是两列商品/素材图片网格，每个素材卡片包含服装图片、名称、颜色标签、风格标签和选择状态。底部固定按钮“确认选择”。整体风格简洁高级，适合服装设计和 AI 试衣，重点展示图片，不要复杂说明文字。
```

## 小程序生成中页面

中文提示词：

```text
设计一个微信小程序 AI 图片生成中页面。页面中间显示人物图和服装图的小预览，中间有箭头或生成动效，下方显示“正在生成试衣效果”，有进度状态：排队中、生成中、即将完成。底部有“稍后查看历史记录”按钮。界面要安静、稳定、有科技感，但不要夸张动画，不要暗黑风。
```

## 小程序结果页

中文提示词：

```text
设计一个微信小程序 AI 试衣结果页面。顶部显示返回按钮和标题“生成结果”。主体是一张大结果图，下面有三个小缩略图：人物原图、服装图、结果图。下方显示本次提示词摘要。底部有两个按钮：“保存图片”和“再生成一次”。整体高级简洁，图片展示要突出，适合服装和面料设计场景。
```

## 小程序历史记录页

中文提示词：

```text
设计一个微信小程序历史记录页面，用于查看用户生成过的 AI 试衣图片。顶部有标题“我的生成”，右侧有筛选按钮。主体是瀑布流或两列网格，每个卡片显示结果图、生成模式、时间、状态。状态包括生成成功、生成中、生成失败。界面简洁，图片优先，适合移动端。
```

## 管理后台首页

中文提示词：

```text
设计一个网页端管理后台 dashboard，产品名 FabricMind Admin。功能是管理 AI 试衣素材、用户上传图片和生成记录。左侧是垂直导航：概览、素材库、用户图片、生成任务、结果图库、设置。顶部是搜索和管理员头像。主体有数据卡片：今日生成、素材数量、成功率、失败任务。下方有最近任务表格和热门素材网格。风格是 SaaS 管理后台，干净、专业、高信息密度，浅色主题，不要营销页，不要大 hero。
```

## 管理后台素材库

中文提示词：

```text
设计一个网页端素材库管理页面，用于管理员上传和管理服装素材。左侧为后台导航，顶部有“上传素材”按钮、搜索框和筛选器。主体是素材表格和图片网格结合：展示缩略图、素材名称、类型、颜色、风格标签、上架状态、创建时间、操作按钮。类型包括模特图、上衣、裤子、裙子、整套、面料。界面专业、清晰、适合长期管理大量图片。
```

## 管理后台任务详情

中文提示词：

```text
设计一个网页端 AI 生成任务详情页面。页面展示任务状态、用户信息、输入人物图、输入服装图、最终结果图、提示词、调用模型、OSS 图片地址、创建时间和错误信息。布局要适合管理员排查问题，图片预览清晰，信息分区明确，浅色 SaaS 后台风格。
```

## 不建议生成的风格

避免：

```text
深色科幻大屏
夸张紫色渐变
营销官网首屏
卡通插画风
过度玻璃拟态
只有文字没有真实图片区域
按钮和文字太大导致不像小程序
```

