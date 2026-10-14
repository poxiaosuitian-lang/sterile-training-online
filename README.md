# 无菌方舟 · 联网服务器

为“无菌方舟”Android 应用提供账号、五关训练评分、成绩同步、排行榜、管理后台和 APK 更新接口。

此仓库用于服务器 Docker 部署，包含 NestJS API、网页管理后台、Prisma 数据库迁移及测试。Android 客户端单独分发；安装后应用名称为 **无菌方舟**。客户端尚未预设正式地址，部署后在登录页填写 `https://你的域名/api/v1`。

## Docker 部署

服务器需安装 Docker Engine 和 Compose 插件。克隆仓库后，在项目根目录执行：

```sh
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env，替换所有密码、JWT_SECRET，填写域名
# 可以分别运行 openssl rand -hex 32 生成随机值
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yml ps
```

- 后台：`https://你的域名/api/v1/admin`
- 玩家 API：`https://你的域名/api/v1`
- 健康检查：`https://你的域名/api/v1/health`

将域名 DNS 指向服务器，开放 80/443，并将 `SITE_ADDRESS` 改成域名，Caddy 会申请 HTTPS。数据库和 Redis 只在容器网络内开放。管理员使用 `deploy/.env` 中的账号密码登录；玩家在 APK 自行注册。

详见 [部署、备份与更新说明](deploy/README.md) 和 [验证记录](deploy/VERIFICATION.md)。

## 本地开发与验证

需要 Node.js 22 和可访问的 PostgreSQL 17；复制环境变量时不要提交真实凭据。

```sh
npm ci
npx prisma generate
npm test
npm run build
npm audit --omit=dev
# 设置 DATABASE_URL 后，执行真实数据库与 HTTP 集成测试
node tools/test_online_integration.cjs
```

集成测试创建随机 `online_test_*` schema，运行迁移并验证注册登录、数据隔离、重复提交、管理后台及五关完整提交流程，最后清理该测试 schema。普通 `npm test` 不连接真实数据库。

可选浏览器测试：安装 Python Playwright 及 Chromium（Windows 使用 Edge），然后执行 `node tools/test_online_integration.cjs --ui`，检查后台登录、搜索、详情、CSV 和手机布局。

GitHub Actions 自动执行服务端单元测试、构建、PostgreSQL 集成测试和 Docker 镜像构建。

## 目录

- `src/`：认证、游戏进度、五关配置与评分、排行榜、后台与更新接口。
- `public/admin.html`：管理后台页面。
- `prisma/`：数据库模型及迁移。
- `deploy/`：Compose、Caddy、环境变量模板及发布目录。
- `test/`、`tools/`：接口和浏览器验证。

`src/levels/standalone-contract.json` 是五关题库与评分回归样例，名称沿用已有导出格式；服务器运行及测试会使用它。

源码不包含正式环境配置、数据库、Android 签名密钥或 APK。公开可见不代表授予再分发许可；本项目尚未提供开源许可证。
