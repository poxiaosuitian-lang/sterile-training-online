#!/bin/sh
# Run from a trusted checkout after git pull --ff-only.
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
command -v python3 >/dev/null
docker compose version >/dev/null
test -f deploy/.env
compose() { docker compose --env-file deploy/.env -f deploy/compose.yml "$@"; }

umask 077
backup_dir=${BACKUP_DIR:-"$project_dir/../sterile-training-backups"}
mkdir -p "$backup_dir"
backup_file=$(mktemp "$backup_dir/before-update-$(date +%Y%m%d-%H%M%S)-XXXXXX.sql")
echo "Backing up PostgreSQL to $backup_file"
compose exec -T postgres pg_dump -U aseptic aseptic_training > "$backup_file"
test -s "$backup_file"

compose up -d --build --wait --wait-timeout 180 api
compose exec -T api node -e "fetch('http://localhost:3000/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
echo 'Recalculating affected completed maze submissions (attempt counts stay unchanged).'
compose exec -T api node dist/maintenance/repair-scores.js --apply
python3 tools/update_apk.py
echo 'Server and APK release updated. Players can restart the app to check for updates.'
echo "Database backup: $backup_file"
