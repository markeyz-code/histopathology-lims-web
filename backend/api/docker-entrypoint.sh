#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${STORAGE_DIR:-/app/storage}"
  chown -R node:node "${STORAGE_DIR:-/app/storage}" 2>/dev/null || true
  exec su-exec node "$@"
fi
exec "$@"
