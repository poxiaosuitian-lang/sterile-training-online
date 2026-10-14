# Docker 部署与维护

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

客户端上传失败会暂存结果，在前台定时、返回应用或手动同步时重试；应用退出后不持续后台上传。登录过期时重新登录原账号补传。服务器保存提交回执，重复和并发重试只结算一次。普通联网玩家不能启用开发者跳关，游客登录默认禁用。

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
