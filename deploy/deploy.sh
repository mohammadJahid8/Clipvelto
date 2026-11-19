#!/bin/bash
set -euo pipefail
cd /var/www/clipvelto
image_tag=${1:?Pass an immutable Git commit SHA}
deployment_mode=${2:-full}
[[ "$image_tag" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid image tag" >&2; exit 1; }
[[ "$deployment_mode" == full || "$deployment_mode" == frontend ]] || { echo "Invalid deployment mode" >&2; exit 1; }
exec 9>.deployment.lock
flock -w 300 9
export IMAGE_TAG="$image_tag"
test -s backend.env && test -s frontend.env && test -s mongo.env && test -s redis.env
install -d -o 1000 -g 1000 -m 700 youtube-session
docker compose -f compose.yaml.next config --quiet
docker compose -f compose.yaml.next pull
if [[ "$deployment_mode" == full ]] && docker compose ps --status running -q api | read -r _; then
  active_jobs=$(docker compose exec -T api node --input-type=module <<'JS'
import { loadEnv } from './dist/config/env.js';
import { createUploadQueue } from './dist/jobs/upload-queue.js';
const queue = createUploadQueue(loadEnv());
try { console.log(await queue.getActiveCount()); }
finally { await queue.close(); }
JS
  )
  [[ "$active_jobs" == 0 ]] || { echo "Deployment postponed: let the active media job finish, then rerun deployment." >&2; exit 1; }
fi
# Keep the previous app/config reference for a deliberate rollback; never
# remove volumes, prune other projects' images, or stop Invitation Maker.
if test -f compose.yaml; then cp compose.yaml compose.yaml.previous; fi
if test -f .image-tag; then cp .image-tag .image-tag.previous; fi
mv compose.yaml.next compose.yaml
if [[ "$deployment_mode" == frontend ]]; then
  # In particular, do not restart the worker just because its image tag changed.
  # Its running source is unchanged, as checked against the deployed Git commit.
  docker compose up -d --no-deps --wait --wait-timeout 240 frontend
else
  docker compose up -d --remove-orphans --wait --wait-timeout 240
fi
printf '%s\n' "$image_tag" > .image-tag
curl --fail --silent --show-error http://127.0.0.1:4002/api/health
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3002/
echo "Clipvelto deployment is healthy on loopback ports 3002/4002."
