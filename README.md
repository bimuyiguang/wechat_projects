# FabricMind Monorepo

This repository contains the current FabricMind workspace:

```text
fabric-mind/              Main Node.js backend, admin UI, and WeChat miniprogram
dianshang/电商前端/       Next.js ecommerce frontend
paletteFusionNet/         Local Python/Tauri material recolor exploration
HANDOFF_FabricMind_*.md   Handoff and deployment notes
```

## Important Rules

- Do not commit real secrets, SSH keys, OSS keys, model API keys, or WeChat AppSecret values.
- Do not commit `fabric-mind/server/runtime-*.json`; they are local runtime stores and may contain users, sessions, orders, tasks, and provider configuration.
- Do not commit `node_modules`, `.next`, Tauri `target`, browser test profiles, screenshots, or deployment archives.
- Large image/resource folders are kept outside Git to keep Gitee pushes reliable. Restore them from the server, OSS, or the local resource package when deploying.
- Production credentials must be provided through environment variables or server-side runtime configuration.

## Local Development

Main backend:

```powershell
cd D:\wechat-projects\fabric-mind
npm run dev
```

Ecommerce frontend:

```powershell
cd D:\wechat-projects\dianshang\电商前端
npm run dev
```

Python material service:

```powershell
cd D:\wechat-projects\paletteFusionNet\python-service
python server.py 5188
```

## Production Deployment Notes

Server alias:

```bash
ssh fabricmind-server
```

Production paths:

```text
/www/wwwroot/fabric-mind
/www/wwwroot/fabric-mind/shop-front
/www/server/panel/vhost/nginx/fabric-mind.conf
```

Shop frontend build:

```bash
cd /www/wwwroot/fabric-mind/shop-front
npm run build
```

Restart shop frontend:

```bash
fuser -k 3000/tcp || true
nohup env NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000 > /www/wwwroot/fabric-mind/shop-front.log 2>&1 &
```

Nginx check/reload:

```bash
sudo nginx -t
sudo nginx -s reload
```

## Current Handoff

Read the latest handoff document before changing behavior:

```text
HANDOFF_FabricMind_2026-06-01.md
```
