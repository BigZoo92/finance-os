# VPS resource limits and swap runbook

Last updated: 2026-06-02

This runbook is for the Finance-OS Dokploy/Docker production VPS. It does not
assume repo agents can access the VPS. Run the commands manually on the server.

## Current observation

- VPS memory observed by the operator: about 7.6 GiB RAM.
- Disk observed by the operator: 150 GB total, about 12 GB used.
- Swap observed by the operator: 0 B.
- Finance-OS runs through Dokploy and Docker Compose.
- Finance-OS containers observed: `web`, `api`, `worker`, `ops-alerts`,
  `postgres`, `redis`, `qdrant`, `neo4j`, `knowledge-service`,
  `quant-service`.
- Other containers are present on the host, including Dokploy/Traefik and
  unrelated Oncarya services. Leave headroom for them.

## Where limits live

The production source of truth is [docker-compose.prod.yml](../../docker-compose.prod.yml).
GitHub Actions pushes that raw compose file to Dokploy with `compose.update`
and then triggers `compose.deploy`.

Resource governance is defined in reusable YAML anchors near the top of the
compose file:

| Service | Memory limit | CPU limit | PIDs |
| --- | ---: | ---: | ---: |
| `web` | 256M | 0.50 | 128 |
| `api` | 1280M | 1.50 | 256 |
| `worker` | 1024M | 1.25 | 256 |
| `ops-alerts` | 256M | 0.25 | 128 |
| `knowledge-service` | 512M | 0.75 | 128 |
| `quant-service` | 512M | 0.75 | 128 |
| `postgres` | 1024M | 1.00 | 256 |
| `redis` | 256M | 0.50 | 128 |
| `qdrant` | 768M | 0.75 | 128 |
| `neo4j` | 2048M | 1.50 | 256 |

These are guardrails, not target utilization. They deliberately cap runaway
containers, but they do not prove the application has no leak. If a service
approaches its limit repeatedly, investigate before raising the limit.

## Compose and Dokploy notes

- The repo uses Dokploy Docker Compose in `raw` mode, not a server-side Git
  build. The release workflow updates the compose file stored by Dokploy.
- Docker Compose resource limits use `deploy.resources.limits` for `cpus`,
  `memory`, and `pids`.
- After deployment, verify actual Docker `HostConfig` values. If the VPS has an
  old Docker/Compose engine that ignores `deploy.resources` outside Swarm, use
  the verification section below to catch it before trusting the limits.
- Do not add both `deploy.resources` and legacy `mem_limit`/`pids_limit` unless
  verification proves the Dokploy host ignores the Compose deploy spec. If that
  happens, change the compose file intentionally and document the fallback.

## Datastore tuning

Postgres:

- Container memory limit: 1024M.
- `shm_size`: 256m.
- Conservative settings: `shared_buffers=256MB`,
  `effective_cache_size=768MB`, `work_mem=4MB`.

Redis:

- Container memory limit: 256M.
- Redis max memory: `192mb`.
- Policy: `noeviction`.
- Rationale: Finance-OS uses Redis for queues, locks, metrics, and subscriptions,
  not only disposable cache. `noeviction` is safer because silent eviction can
  break correctness. If Redis is later proven to be only cache for a specific
  service, `allkeys-lru` can be considered for that service only.

Neo4j:

- Container memory limit: 2048M.
- Heap initial: `512m`.
- Heap max: `1024m`.
- Pagecache: `512m`.
- Heap + pagecache stays below the container limit to leave JVM/native overhead.

## Log rotation

The compose file sets per-service Docker `json-file` rotation:

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "5"
```

Prefer this per-service setting. A global `/etc/docker/daemon.json` logging
change requires restarting Docker and affects every container on the VPS. Do not
restart Docker during peak usage; use a maintenance window if a daemon-level
change is ever required.

Do not run `docker system prune` blindly. It can remove images or networks that
are useful for rollback/debugging, and `docker system prune --volumes` can remove
data. The repo has [infra/dokploy/host-cleanup.sh](../../infra/dokploy/host-cleanup.sh)
for a narrower cleanup path.

## Add 4 GiB swap

Swap is an emergency safety net, not normal operating memory. If swap starts
growing under regular load, treat that as a capacity or leak signal.

Run as root, or prefix commands with `sudo`.

```bash
set -euo pipefail

echo "== Before =="
free -h
swapon --show || true
df -h /

if [ -f /swapfile ]; then
  echo "/swapfile already exists. Not overwriting."
  ls -lh /swapfile
else
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi

if ! grep -qE '^/swapfile\s+none\s+swap\s+sw\s+0\s+0' /etc/fstab; then
  cp /etc/fstab "/etc/fstab.backup.$(date -u +%Y%m%dT%H%M%SZ)"
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

cat > /etc/sysctl.d/99-finance-os-memory.conf <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF

sysctl --system

echo "== After =="
free -h
swapon --show
sysctl vm.swappiness
sysctl vm.vfs_cache_pressure
```

## Roll back swap

Run as root, or prefix commands with `sudo`.

```bash
set -euo pipefail

swapoff /swapfile || true
sed -i.bak '/^\/swapfile\s\+none\s\+swap\s\+sw\s\+0\s\+0/d' /etc/fstab
rm -f /swapfile
rm -f /etc/sysctl.d/99-finance-os-memory.conf
sysctl --system

free -h
swapon --show || true
```

## Post-deploy validation

Run after the tagged release deploys. Container names can vary by Dokploy app
suffix; the `finance-os-app-bm30nn-api-1` name below is the observed example.

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}'

docker inspect finance-os-app-bm30nn-api-1 --format '
Name={{.Name}}
MemoryLimit={{.HostConfig.Memory}}
MemorySwap={{.HostConfig.MemorySwap}}
MemoryReservation={{.HostConfig.MemoryReservation}}
NanoCpus={{.HostConfig.NanoCpus}}
PidsLimit={{.HostConfig.PidsLimit}}
RestartPolicy={{.HostConfig.RestartPolicy.Name}}
'

free -h
swapon --show
df -h /
```

To inspect every Finance-OS container in one pass:

```bash
docker ps --format '{{.Names}}' \
  | grep -E 'finance-os|web|api|worker|ops-alerts|postgres|redis|qdrant|neo4j|knowledge-service|quant-service' \
  | while read -r name; do
      echo "== ${name} =="
      docker inspect "${name}" --format 'MemoryLimit={{.HostConfig.Memory}} MemoryReservation={{.HostConfig.MemoryReservation}} NanoCpus={{.HostConfig.NanoCpus}} PidsLimit={{.HostConfig.PidsLimit}} OOMKilled={{.State.OOMKilled}} RestartPolicy={{.HostConfig.RestartPolicy.Name}}'
    done
```

Expected signs:

- `MemoryLimit` is non-zero for each long-running Finance-OS service.
- `NanoCpus` is non-zero where CPU limits are configured.
- `PidsLimit` is non-zero.
- `OOMKilled=false` after normal startup.
- `docker stats` memory limits match the intended service caps.

## 12h/24h memory watch

This samples Docker stats every five minutes for 12 hours.

```bash
cat > /tmp/finance-os-resource-watch.sh <<'BASH'
#!/usr/bin/env bash
set -u
OUT="/tmp/finance-os-resource-watch-$(date -u +%Y%m%dT%H%M%SZ).tsv"
echo -e "ts\tname\tcpu\tmem_usage\tmem_percent\tpids" > "$OUT"

for i in $(seq 1 144); do
  NOW="$(date -Is)"
  docker stats --no-stream --format "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}" \
    | awk -v now="$NOW" -F "\t" "{print now \"\t\" \$0}" >> "$OUT"
  sleep 300
done

echo "$OUT"
BASH

chmod +x /tmp/finance-os-resource-watch.sh
nohup bash /tmp/finance-os-resource-watch.sh > /tmp/finance-os-resource-watch.nohup.log 2>&1 &
```

Review after 12h and again after 24h:

```bash
tail -n 50 /tmp/finance-os-resource-watch-*.tsv
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}'
free -h
swapon --show
```

Adjustment rule:

- If `api` climbs steadily and does not return down after traffic settles,
  investigate logs/heap behavior. Do not raise the limit first.
- If a datastore reaches 80%+ memory during normal load, inspect its internal
  metrics and data growth before raising Docker memory.
- If swap is used during deploy bursts then returns near zero, keep observing.
- If swap grows during normal idle/low traffic, treat it as a P1 capacity/leak
  signal.
- If a service is OOM-killed once during deploy, review startup memory and logs.
  If it repeats, roll back or tune before increasing limits.

## Roll back resource governance

Preferred rollback is a previous immutable tag through the release workflow or
Dokploy `APP_IMAGE_TAG`. Do not edit the VPS containers by hand as a long-term
fix; that drifts from the repo source of truth.

Immediate checks before rollback:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}'
docker logs --tail=200 finance-os-app-bm30nn-api-1
```

If the issue is only resource-limit related, redeploy the last known good tag or
make a targeted compose change, then verify `HostConfig` again.

## References

- Docker Compose deploy resources: https://docs.docker.com/reference/compose-file/deploy/
- Docker resource constraints: https://docs.docker.com/engine/containers/resource_constraints/
- Dokploy Docker Compose raw deployments: https://docs.dokploy.com/docs/core/docker-compose
- Dokploy Compose API: https://docs.dokploy.com/docs/api/compose
