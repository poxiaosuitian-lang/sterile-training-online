# 无菌方舟网页版部署

请在现有 wu.yikui.fun Docker 项目上增加玩家网页入口，使用仓库 https://github.com/poxiaosuitian-lang/sterile-training-online 的 main 分支最新代码。

目标：在用户分配的独立游戏域名显示无菌方舟游戏（域名由我在服务器上另行提供，不要使用管理员域名），iPhone 用户用 Safari 打开并横屏玩。原安卓 APK、账号成绩、管理员后台 `/api/v1/admin` 和维护设置全部保留。本次不部署 IPA，也不需要苹果开发者账号。

1. 进入现有部署目录（通常 /opt/sterile-training-online），检查本地修改；保护现有 .env、代理配置、数据库卷和下载目录，不强制覆盖部署定制，不重置账号或成绩。
2. 备份 PostgreSQL 后 `git pull --ff-only`，重建 API 容器。可使用已有 `sh tools/deploy_update.sh`，它会备份数据库、重建 API 并同步现有安卓发布。此次网页版包含在仓库 public/play 中，构建服务器无需安装 Flutter。
3. SITE_ADDRESS 保持原管理员域名。在 deploy/.env 中填写不同的 GAME_SITE_ADDRESS，确认 DNS 和证书，然后将 deploy/game-domain.Caddyfile.example 复制为 deploy/game-sites/player.caddy；执行 `docker compose --env-file deploy/.env -f deploy/compose.yml up -d --force-recreate gateway`。该模板让游戏域名根路径跳转 /play/，只代理游戏资源和玩家 API，不暴露 /api/v1/admin、文档或 APK 下载；原域名继续提供管理员后台及安卓 API，但不提供 /play/。如使用面板或 Nginx，请做同等配置，先验证配置再重载。尚未收到游戏域名时先准备配置，不猜域名申请证书。
4. 在原域名验证 `/api/v1/health`；在游戏域名验证 `/play/`、`/play/main.dart.js`、`/play/canvaskit/canvaskit.wasm`、`/play/assets/assets/fonts/NotoSansSC.ttf` 均为 200 且类型正确，静态文件 Cache-Control 为 no-cache。缺失的 JS 路径应返回 404。
5. 验证游戏域名的 `/api/v1/admin` 返回 404、原管理员域名的 `/play/` 返回 404；验证原域名管理员后台可用，`/api/v1/app/access` 保持现有维护状态；不要自行开放维护、创建正式玩家或更改密码。使用获授权的测试账号验证网页登录、关卡操作和成绩同步。不可把凭据打印到日志或提交仓库。
6. 安卓 `/api/v1/app/release` 仍指向原 APK 1.0.92 / 93（若服务器已有更新版本则保留更新版本），不能将网页 ZIP 当作 APK 更新，也不要覆盖安卓 latest.json。

网页包版本为 web-1.0.93。使用页面刷新获取新代码；不要在未完成关卡中刷新。网页使用当前域名下 /api/v1 API，不需要填服务器地址。可通过 Safari 分享菜单添加到主屏幕，但仍是联网网页。未上传的成绩暂存同一浏览器，清除网站数据会删除本地待上传记录，已上传成绩仍在服务器。

不要清库、不要重新导入名单、不要为了测试关闭现有维护。完成后报告代码版本、备份路径、上述 URL 检查结果和可供学生使用的网址。
