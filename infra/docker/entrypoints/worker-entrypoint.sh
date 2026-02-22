#!/bin/sh
set -eu

exec bun apps/worker/src/index.ts
