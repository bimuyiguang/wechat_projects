# FabricMind 管理后台简单版说明

## 目标

管理后台给管理员使用，不给普通用户使用。

核心作用：

```text
管理素材库
查看用户上传
查看生成任务
查看生成结果
处理失败任务
```

## 页面结构

### 1. 登录页

第一版可以只有一个管理员账号。

字段：

```text
账号
密码
登录按钮
```

后续再接多管理员和权限。

### 2. 概览页

展示系统状态：

```text
今日生成数量
今日成功数量
失败任务数量
素材总数
用户上传图片数量
OSS 存储概览
```

最近任务表：

```text
任务 ID
用户
模式
状态
创建时间
操作
```

### 3. 素材库管理

管理员上传素材，供小程序用户选择。

素材类型：

```text
模特图
上衣
裤子
裙子
整套
面料
参考风格图
```

素材字段：

```text
id
name
type
tags
color
style
oss_url
thumbnail_url
status
created_at
updated_at
```

状态：

```text
上架
下架
草稿
```

第一版操作：

```text
上传
编辑
下架
删除
查看大图
```

### 4. 用户图片管理

查看用户自己上传的人物图和服装图。

字段：

```text
用户 ID
图片类型
OSS URL
上传时间
关联任务数
```

### 5. 生成任务管理

所有生成请求都应该有任务记录。

任务字段：

```text
task_id
user_id
mode
person_image_url
garment_image_url
prompt
final_prompt
status
result_image_url
error_message
created_at
finished_at
```

任务状态：

```text
queued
running
success
failed
cancelled
```

管理员操作：

```text
查看详情
重新生成
标记失败
复制错误信息
查看 OSS 图片
```

### 6. 结果图库

展示所有生成成功的图片。

功能：

```text
按时间筛选
按模式筛选
按用户筛选
查看原图和结果图
下载结果图
```

### 7. 设置

第一版只做基础配置展示：

```text
OSS Bucket
OSS Endpoint
DashScope 区域
默认生成模式
图片最大尺寸
```

敏感配置不在网页明文展示完整值。

## 管理后台第一版最小功能

先做：

```text
登录
素材上传
素材列表
任务列表
任务详情
结果图库
```

暂时不做：

```text
复杂角色权限
数据统计大屏
批量审核
计费系统
多人协作
```

