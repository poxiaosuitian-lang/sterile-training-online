# Docker 部署与维护

## 独立域名的网页入口（web-1.0.93）

管理员域名继续使用 `SITE_ADDRESS`（现有 wu.yikui.fun），游戏使用另一个域名 `GAME_SITE_ADDRESS`，由服务器管理员自行填写。两者必须不同，DNS 均指向服务器。学生打开游戏域名根地址自动进入 `/play/`，管理员仍使用原域名的 `/api/v1/admin`。

使用仓库 Caddy 时：在 `deploy/.env` 设置 `GAME_SITE_ADDRESS=你的游戏域名`，然后复制 `deploy/game-domain.Caddyfile.example` 为 `deploy/game-sites/player.caddy`。运行 `git pull --ff-only`、`sh tools/deploy_update.sh` 更新 API 后，执行 `docker compose --env-file deploy/.env -f deploy/compose.yml up -d --force-recreate gateway` 应用新增域名与挂载，再校验日志和证书。启用游戏站点文件前必须填写域名。自定义 Nginx/面板部署可按模板配置同等路由。

游戏域名只开放 `/play/` 和玩家 API，管理员路径、下载接口和文档返回 404；管理员域名不提供 `/play/`。原安卓客户端的 API 地址和 APK 更新保持正常。游戏网页调用自己的域名下 `/api/v1`，代理至同一个 API 容器，共用账号、成绩、密码、开发者校验码和维护设置，不需要跨域授权。

iPhone 使用 Safari 横屏打开，可在分享菜单中添加到主屏幕，无需 IPA、苹果开发者账号或 TestFlight。首次加载后点击“进入方舟”启用浏览器音效。网页文件位于 `public/play`，随 Docker 镜像部署，服务器无需安装 Flutter。中文字体和渲染器由游戏站点本身提供。

资源使用 no-cache 重新验证，不注册离线 Service Worker。更新后刷新获取新版本，进行中的关卡不要刷新。网络失败的已完成成绩会在同一浏览器暂存重试；清理网站数据会丢失本地待上传记录，服务器已保存成绩不受影响。网页测试版本为 web-1.0.93；安卓仍使用原 APK，不修改 latest.json。

验证游戏域名的 `/play/`、`/play/main.dart.js`、`/play/canvaskit/canvaskit.wasm` 返回 200，`/api/v1/admin` 返回 404；管理员域名的后台正常且 `/play/` 返回 404。实际 iPhone 的音频、键盘和后台恢复仍需真机验收。

以下命令均在仓库根目录执行。

## 首次部署

```sh
cp deploy/.env.example deploy/.env
# 编辑 deploy/.env 后执行：
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yml logs --tail=100 api
```

配置项：

| 配置 | 填写方式 |
| --- | --- |
| `POSTGRES_PASSWORD` | 使用独立随机十六进制字符串，避免数据库 URL 中的特殊字符 |
| `JWT_SECRET` | 至少 32 位独立随机字符串；修改会使已有登录失效 |
| `ADMIN_USERNAME` | 3–32 位字母、数字或下划线 |
| `ADMIN_PASSWORD` | 12–128 位独立密码 |
| `SITE_ADDRESS` | 正式部署填写域名，如 `training.example.com`，无需 `https://` |
| `HTTP_PORT` / `HTTPS_PORT` | 默认为 80 / 443 |

可以多次运行 `openssl rand -hex 32` 生成不同随机值。所有 `replace_with_...` 占位值都必须替换。环境变量文件不得上传 GitHub。

域名 DNS 需指向服务器，80/443 端口可用；Caddy 自动申请 HTTPS。`SITE_ADDRESS=:80` 仅用于本地 HTTP 验证。若服务器已有反向代理，需要按已有端口和 TLS 配置接入。

后台：`https://域名/api/v1/admin`（域名根路径也会跳转）。玩家 API：`https://域名/api/v1`。健康检查：`https://域名/api/v1/health`。

API 以非 root 用户运行；启动时自动执行数据库迁移。PostgreSQL、Redis 不映射宿主机端口。账号、成绩和缓存分别保存在命名卷中，APK 发布目录以只读方式挂载。

## 账号与成绩

玩家在“无菌方舟”联网 APK 注册账号和密码。1.0.86 起的联网 APK 已预设 `https://wu.yikui.fun/api/v1`；旧 APK 需要填写该地址才能连接。管理员账号来自服务器环境配置，与玩家账号相互独立。

后台支持账号和昵称搜索、分页、五关完成度、最高分、挑战记录及 CSV 导出。开始次数包含未提交挑战；提交次数是服务端已结算次数。成绩按玩家保存，不按 APK 版本分组。

客户端上传失败会暂存结果，在前台定时、返回应用或手动同步时重试；应用退出后不持续后台上传。登录过期时重新登录原账号补传。服务器保存提交回执，重复和并发重试只结算一次。未授权玩家不能启用开发者跳关，游客登录默认禁用。

## 1.0.88 评分规则更新部署（2026-10-19）

本次必须同时更新服务器评分代码和 APK，仅下载 APK 无法修复旧服务器的评分逻辑。在已有运行中的部署执行：

```sh
cd /opt/sterile-training-online
git pull --ff-only
sh tools/deploy_update.sh
```

脚本会先将 PostgreSQL 备份到仓库旁的 `sterile-training-backups/`，随后重建 API 并等待健康检查，修复符合条件的历史第三关成绩，再从 GitHub 最新 Release 发布 APK。需要 Python 3、支持 `--wait` 的 Docker Compose，以及 GitHub 下载访问。过程失败会停止；如果最后下载 APK 失败，服务器评分已修复，可稍后单独重试 `python3 tools/update_apk.py`。

评分规则：第三关碰墙只阻挡移动，不扣分；集齐七个碎片、答案正确且到达出口才算完成。污染区扣分保留，但完成后最低 60 分。第二关恢复原有规则：误点每次扣 5 分，即使找齐所有目标，低于 60 分仍不通过，不设置保底分。未完成要求的记录不会被补成通关。第一、四、五关维持原有判定。

历史修复根据数据库原始 submission 和当次 challenge 重算，只修正第三关已完成要求且分数可提高的记录，更新最高分、通关及下一关解锁，保留挑战次数与原始 ScoreEvent 审计记录。旧回执保存在新回执的 `scoringCorrection.previousReceipt` 中。重复执行不会重复增加成绩或次数；缺少原始提交/回执的记录不会凭空补分。可先单独预览（不加 `--apply` 不写入）：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T api node dist/maintenance/repair-scores.js
```

更新后访问 `/api/v1/levels`，第二关版本应为 8、第三关为 7，第三关 `collisionPenalty` 为 0；`/api/v1/app/release` 应显示 1.0.88 / 89。玩家重新打开应用检查更新；历史成绩修复后，在首页刷新或重新登录即可同步。

## 从 GitHub 更新服务器上的 APK

开发机把同签名 APK、`latest.json` 和 `SHA256SUMS` 发布到 GitHub Release 后，在服务器执行（需要 Python 3，且能访问 GitHub 及其下载域名）：

```sh
cd /opt/sterile-training-online
git pull --ff-only
python3 tools/update_apk.py
```

脚本从此仓库最新正式 Release 下载安装包、校验 SHA-256，先放好 APK，再原子替换 `deploy/releases/latest.json`。重复执行不会重复下载完整的同版安装包，不会降级到更旧版本；网络失败或校验失败时保留原更新清单。不需要重启 Docker。

运行后访问 `https://wu.yikui.fun/api/v1/app/release` 检查版本号。已经连接该服务器的旧版用户重新启动应用时会收到更新提示；还没配置地址的旧 APK 需先填写地址，或手动安装新版。仅执行 `git pull` 不会下载 Release 附件，也不会自动更新玩家手机里的 APK。

如果服务器不能访问 GitHub，可从 [Release 页面](https://github.com/poxiaosuitian-lang/sterile-training-online/releases/latest) 下载附件后手动上传；先 APK、后 `latest.json`。

## 发布 APK 更新

客户端由开发机独立构建，并沿用同一包名和发布签名。应用显示名为“无菌方舟”。此服务器仓库不包含 Android 构建源码与签名文件。

1. 获得比已发布版本更大 `versionCode` 的同签名联网 APK。
2. 将 APK 放到服务器 `deploy/releases/`，例如 `sterile-online-86.apk`。
3. 最后写入 `deploy/releases/latest.json`：

```json
{"versionCode":86,"versionName":"1.0.85","notes":"修复训练内容、完善音效和显示","fileName":"sterile-online-86.apk"}
```

先上传完整 APK 再替换清单，避免玩家下载不完整文件。目录更新无需重建 API。客户端检查更新后，由浏览器下载安装包，再由用户确认安装。旧 APK 可暂时保留供进行中的下载使用。

首次部署前应妥善备份发布签名；更换签名会导致现有安装无法直接升级。

## 备份与更新服务端

先备份，再拉取新代码和重建 API：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T postgres pg_dump -U aseptic aseptic_training > training-backup.sql
git pull --ff-only
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build api
docker compose --env-file deploy/.env -f deploy/compose.yml ps
```

将数据库备份放在仓库外并妥善保存。环境文件、数据库备份、发布 APK 和签名分别备份。不要使用 `down -v`，它会删除持久化数据卷。修改数据库密码时需同步数据库实际用户密码，不能只修改环境文件。

## 验证

参考根目录 README。集成测试需要具有创建 schema 权限的独立测试数据库连接，建议在测试环境运行。可选浏览器测试会将测试截图和 CSV 保存到本地 `tmp/online-review/`，该目录不进入版本库。


## 1.0.91 账号管理更新

先 `git pull --ff-only`，再运行 `sh tools/deploy_update.sh`。该脚本备份数据库、重建 API、执行迁移和同步最新 APK。保留原有环境配置、数据库卷、JWT 密钥及发布签名。旧玩家凭证可继续使用；修改密码会使该玩家的旧凭证失效。更新后刷新后台页面。

后台新增：
- “新增玩家”：学号作为账号、姓名作为昵称；可设置初始密码。关闭自行注册不影响管理员添加或导入。
- “勾选全部搜索结果”：跨页选择；可逐个取消。“重置所选进度”清除所选玩家五关成绩、进度、挑战记录和待结算会话，保留账号密码。操作前有确认。
- “删除账号”：删除该玩家及关联记录，旧登录凭证失效。操作前有确认。
- 注册开关：保存在数据库，重启后仍有效。默认保持开放，不会在更新时自动改变现有选择。
- “导入玩家名单”：上传私有 JSON 并输入初始密码。格式为 `{"players":[{"username":"sample_student","nickname":"示例学生"}]}`。每批最多 1000 人；同账号同名自动合并，同账号异名整批拒绝；已有账号密码与成绩均保留。

也可在容器中运行导入 CLI：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml cp /安全路径/players.json api:/tmp/players.json
# 从安全环境变量读取初始密码，不在源码、日志或名单文件中存储密码。
# 先导出 ROSTER_INITIAL_PASSWORD，再执行：
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T -e ROSTER_INITIAL_PASSWORD api node dist/maintenance/import-players.js --file /tmp/players.json
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T -e ROSTER_INITIAL_PASSWORD api node dist/maintenance/import-players.js --file /tmp/players.json --apply
unset ROSTER_INITIAL_PASSWORD
```

第一条 CLI 命令只预览，第二条才写入。输出统计数量，不打印姓名或密码。完成后移除容器临时名单，私有原件仅留在受限目录。不要提交名单到公有仓库、放到 APK 下载目录或放进 Docker 构建上下文。

玩家更新 APK 后，在设置中修改密码；原密码必须正确，新密码 8–128 位。登录仅需账号和密码，无需填写姓名。重置过的旧会话补传会被拒绝，玩家重新开始第一关。


### 开发者校验码

后台“设置开发者校验码”可保存 6–64 位校验码，或停用入口。默认未设置，没有内置通用码。服务器仅保存加盐哈希，不向客户端或管理员接口返回原码。

玩家在设置中打开开发者模式，输入正确校验码后才启用。授权只留在本次应用内存中，最长 8 小时；重启应用、退出登录、关闭模式或修改密码后需重新校验。管理员更换或停用校验码后，旧授权不能再开始开发者关卡。已开始的关卡仍可按正常规则结算。

按项目要求，授权开发者模式完成的成绩照常计入正式进度、关卡解锁和管理员成绩导出。未提供授权、伪造或借用其他玩家授权均不能跳关。排行榜服务及客户端路由已移除，原路径返回 404；个人成绩和管理员统计保持可用。


## 1.0.92 维护公告与开放控制

在后台点击“维护中”，编辑标题（1–60 字）、正文（1–2000 字），勾选“维护中”并保存。默认开放。设置持久化于现有 AppSetting 表，本次无新增数据库迁移。

新版 APK 登录后先检查服务器开放状态，维护期间只显示公告、刷新状态、检查更新和退出账号。开放检查每 15 秒执行，也在返回前台时执行；状态请求失败时不会放行。结束维护后自动恢复首页。单机版不受此开关影响。

“周一上午再开放”是自定义文字，并非定时任务，到时需管理员手动取消锁定。已开始的关卡允许正常结算；新关卡包括开发者模式均返回 HTTP 423 和公告内容。旧 APK 不支持全屏公告，但不能绕过服务端入口限制。

部署仍运行 `git pull --ff-only` 和 `sh tools/deploy_update.sh`，先更新服务器，再通知玩家更新至 1.0.92 / 93。不要因为部署而改变现有注册开关、开发者校验码或玩家数据。维护开关初次为关闭，发布代码不等于实际开启维护。
