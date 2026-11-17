#!/bin/bash
set -euo pipefail
cd /var/www/clipvelto
image_tag=${1:?Pass an immutable Git commit SHA}
[[ "$image_tag" =~ ^[a-f0-9]{40}$ ]] || { echo "Invalid image tag" >&2; exit 1; }
exec 9>.deployment.lock
flock -w 300 9
export IMAGE_TAG="$image_tag"
test -s backend.env && test -s frontend.env && test -s mongo.env && test -s redis.env
docker compose -f compose.yaml.next config --quiet
docker compose -f compose.yaml.next pull
# Keep the previous app/config reference for a deliberate rollback; never
# remove volumes, prune other projects' images, or stop Invitation Maker.
if test -f compose.yaml; then cp compose.yaml compose.yaml.previous; fi
if test -f .image-tag; then cp .image-tag .image-tag.previous; fi
mv compose.yaml.next compose.yaml
docker compose up -d --remove-orphans --wait --wait-timeout 240
printf '%s\n' "$image_tag" > .image-tag
curl --fail --silent --show-error http://127.0.0.1:4002/api/health
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:3002/
echo "Clipvelto deployment is healthy on loopback ports 3002/4002."
