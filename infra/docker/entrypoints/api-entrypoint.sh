#!/bin/sh
set -eu

if [ $# -eq 0 ]; then
  exec bun apps/api/src/index.ts
fi

exec "$@"
