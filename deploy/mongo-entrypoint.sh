#!/bin/bash
set -euo pipefail
key=/data/configdb/clipvelto-keyfile
if [ ! -s "$key" ]; then
  openssl rand -base64 756 > "$key"
fi
chown mongodb:mongodb "$key"
chmod 400 "$key"
exec /usr/local/bin/docker-entrypoint.sh mongod --bind_ip_all \
  --replSet clipvelto --keyFile "$key" --wiredTigerCacheSizeGB 0.25
