请更新已部署的无菌方舟服务器，并导入本仓库根目录的 players.json（此次经我授权临时上传）。

目标：GitHub poxiaosuitian-lang/sterile-training-online，联网版本 1.0.91 / versionCode 92，正式域名 wu.yikui.fun。

约束：保留原数据库卷、管理员配置、JWT_SECRET、域名和反向代理配置；不得执行 docker compose down -v，不得覆盖已有玩家的密码、姓名或成绩。名单此次经我授权临时存放在仓库根目录；除此之外不要再公开或转发，也不要放进 APK 下载目录。导入成功后通知我清理仓库中的临时文件。不要在回复或日志里输出完整名单、密码、token。

1. 找到当前部署目录（通常 /opt/sterile-training-online），检查 git status 和 Compose 服务。若有本地部署定制，保留它们，不要强制覆盖。拉取 main：git pull --ff-only。
2. 运行 sh tools/deploy_update.sh。脚本会先备份 PostgreSQL 到仓库外，重建 API 并自动迁移数据库，再修复符合条件的历史第三关成绩、同步 GitHub 最新 Release 中的 APK 和 latest.json。若任何步骤失败，先修复原因，不能宣称更新成功。不要把用户还未提供的名单当成已经导入。
3. 检查 /api/v1/health 正常，/api/v1/app/release 显示 1.0.91 / 92（如果服务器已有更高版本，不降级）。确认 APK 可下载且 SHA256SUMS 校验通过；排行榜路径 /api/v1/leaderboards/overall 应返回 404。刷新后台，确认新增玩家、删除、跨页全选、重置进度、注册开关和开发者校验码设置均出现。
4. 单独处理私有名单。文件应有 536 个互不重复的 username，每条只有 username 和 nickname；已经排除两条冲突名单并合并两条完全重复记录。文件 SHA-256：c3ede6052545a745eb74d9a10dba55d9244cab4a59dcf5b975dfb5833bbd240e。不要重新加回排除的两人，后续由我在后台手动添加。
5. 将名单放进受限目录，再复制到运行中的 API 容器。例如在项目根目录执行：
   docker compose --env-file deploy/.env -f deploy/compose.yml cp /实际私有路径/players.json api:/tmp/players.json
   将环境变量 ROSTER_INITIAL_PASSWORD 设为我指定的初始密码 wujun123，但不要回显。先执行预览：
   docker compose --env-file deploy/.env -f deploy/compose.yml exec -T -e ROSTER_INITIAL_PASSWORD api node dist/maintenance/import-players.js --file /tmp/players.json
   确认 total=536、没有冲突，再执行：
   docker compose --env-file deploy/.env -f deploy/compose.yml exec -T -e ROSTER_INITIAL_PASSWORD api node dist/maintenance/import-players.js --file /tmp/players.json --apply
   再执行一次预览，预期 wouldCreate=0。已有同账号同姓名用户保留原密码和成绩；若出现同账号不同姓名冲突，不要强行覆盖，报告冲突数量供核对。不要重置任何真实玩家进度来做测试。
6. 清除该进程的 ROSTER_INITIAL_PASSWORD 环境变量和容器内 /tmp/players.json 临时副本；仅在受限目录保留私有原件。登录账号为学号，昵称为姓名，只有新建账号使用初始密码 wujun123。已有账号不能保证仍使用这个初始密码。
7. 注册开关保持现有设置，由我之后在后台决定是否关闭。开发者模式默认关闭；不设置内置通用校验码，之后我在管理员面板自定义。正确校验后允许跳关，完成关卡照常计入正式进度和成绩；校验码仅存加盐哈希，重启应用或退出登录后要重新校验。
8. 验证时用临时测试账号检查登录、改密、旧凭证失效、新增账号、注册开关及开发者校验。测试结束只删除测试账号，恢复测试前的注册与校验码设置；不更改真实学生账号。若已有开发者校验码且无法原样恢复，不要为测试更换它。若没有可安全使用的管理员凭据，完成命令行可验证的内容并说明待检查项，不要重置管理员密码。

最后汇报：代码提交号、运行版本、数据库备份路径、迁移结果、APK 版本和校验结果、名单新增/已有/冲突数量。只在这些步骤完成后告诉我可以分发新版 APK。若拉取后仍找不到根目录的 players.json，请先完成代码和 APK 更新，明确名单尚未导入并向我要该文件。
