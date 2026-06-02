#!/usr/bin/env bash
# Reclaims disk space on the Dokploy host without touching live data.
#
# Safe to run while services are up:
#   - prunes only stopped containers, dangling images, unused networks
#   - prunes unused images (not referenced by any container)
#   - prunes BuildKit cache
#   - DOES NOT touch named volumes (postgres_data, redis_data, etc.)
#
# Recommended cadence: daily via cron (see comment block at the bottom).
#
# Exit 0 on success. Outputs a before/after summary.

set -euo pipefail

log() {
  printf '[host-cleanup] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

disk_root() {
  df -B1 --output=avail / | tail -n1
}

humanize() {
  # Convert bytes to a human-readable size. Falls back to printing the raw
  # value if numfmt is unavailable (BSD/macOS).
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec --suffix=B "$1"
  else
    printf '%s bytes' "$1"
  fi
}

before=$(disk_root)
log "free space before: $(humanize "$before")"

log "docker container prune (stopped containers only)"
docker container prune --force --filter "until=24h" >/dev/null

log "docker image prune -a (unused images)"
docker image prune --all --force >/dev/null

log "docker network prune (unused networks)"
docker network prune --force >/dev/null

log "docker builder prune (BuildKit cache)"
docker builder prune --all --force >/dev/null

# Truncate large per-container json logs (defensive: compose now caps these
# at 50 MB each, but pre-existing log files can still be huge).
log "truncating oversized container logs (>50 MB)"
find /var/lib/docker/containers \
  -name "*-json.log" \
  -type f \
  -size +50M \
  -exec truncate -s 0 {} + 2>/dev/null || true

after=$(disk_root)
log "free space after:  $(humanize "$after")"
delta=$((after - before))
log "reclaimed:         $(humanize "$delta")"

# To install as a daily cron (run as root or a docker-group user):
#
#   sudo cp infra/dokploy/host-cleanup.sh /usr/local/bin/finance-os-host-cleanup
#   sudo chmod +x /usr/local/bin/finance-os-host-cleanup
#
# Then add to /etc/cron.daily/finance-os-host-cleanup:
#
#   #!/bin/sh
#   /usr/local/bin/finance-os-host-cleanup >> /var/log/finance-os-host-cleanup.log 2>&1
#
# And make it executable:
#
#   sudo chmod +x /etc/cron.daily/finance-os-host-cleanup
