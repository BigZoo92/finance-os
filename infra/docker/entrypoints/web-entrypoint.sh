#!/bin/sh
set -eu

exec node apps/web/.output/server/index.mjs
