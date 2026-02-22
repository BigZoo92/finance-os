#!/bin/sh
set -eu

exec bun apps/api/src/bootstrap.ts
