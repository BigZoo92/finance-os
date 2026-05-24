# Dokploy Deployment Notes

Last updated: 2026-05-24

## Daily Intelligence Env

Set these values on both API and worker services through Dokploy. API needs them for `/ops/scheduler/status`; worker needs them to execute the schedule.

```dotenv
DAILY_INTELLIGENCE_ENABLED=false
DAILY_INTELLIGENCE_TIMEZONE=Europe/Paris
DAILY_INTELLIGENCE_NIGHT_CRON=15 23 * * *
DAILY_INTELLIGENCE_MORNING_CRON=30 7 * * *
DAILY_INTELLIGENCE_LOCK_TTL_SECONDS=1800
DAILY_INTELLIGENCE_MAX_DURATION_SECONDS=3600
DAILY_INTELLIGENCE_DRY_RUN_DEFAULT=false
DAILY_INTELLIGENCE_MANUAL_TRIGGER_ENABLED=true
```

Keep `DAILY_INTELLIGENCE_ENABLED=false` until the deployment has:

1. applied migrations `0033_daily_intelligence_foundation.sql` and `0034_investment_strategy_brain.sql`;
2. passed `GET /ops/scheduler/status`;
3. passed `POST /ops/refresh/all` with `{"trigger":"scheduled","runKind":"night","dryRun":true}` and verified `investment-learning-review` then `investment-action-plan`;
4. passed `POST /dashboard/news/ingest` with `{"trigger":"social_poll"}`.
5. passed `POST /dashboard/advisor/investment-plan/generate` with `{"trigger":"internal","dryRun":true}` using an admin session or `x-internal-token`.

Only then set `DAILY_INTELLIGENCE_ENABLED=true` on the worker.

Never paste provider secrets into worker-only scheduler variables.

## Investment Strategy Brain

No new Dokploy env variable is required for the Investment Strategy Brain in this pass.

It reuses:

- `AI_ADVISOR_ENABLED`
- `DAILY_INTELLIGENCE_ENABLED`
- `KNOWLEDGE_SERVICE_ENABLED`
- `ADVISOR_GRAPH_INGEST_ENABLED`
- existing market-data and external-investment provider envs

The graph write path remains fail-soft. `ADVISOR_GRAPH_INGEST_ENABLED=true` is supported when the knowledge service is ready and the storage volume is writable by the app user.

### Knowledge graph storage volume

Production sets:

```dotenv
KNOWLEDGE_GRAPH_STORAGE_PATH=/data/knowledge-graph
```

The knowledge-service runs as a non-root `app` user. The Compose stack includes a one-shot `knowledge-service-storage-init` service that mounts `knowledge_graph_data`, creates `/data/knowledge-graph`, and repairs ownership/mode with:

```bash
chown -R app:app /data/knowledge-graph
chmod -R u+rwX,g+rwX /data/knowledge-graph
```

Do not replace this with `chmod 777`. If Dokploy recreates or restores the named volume as root-owned, the init step must complete before `knowledge-service` starts.

Post-deploy check:

```bash
docker exec finance-os-app-bm30nn-knowledge-service-1 sh -lc '
id
touch /data/knowledge-graph/.write-test &&
rm /data/knowledge-graph/.write-test &&
echo OK
'
```

If `/knowledge/ingest/advisor` returns `knowledge_ingest_permission_denied_storage`, inspect the storage diagnostic log and the `knowledge-service-storage-init` logs first.
