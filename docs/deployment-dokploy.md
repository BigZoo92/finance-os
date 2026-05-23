# Dokploy Deployment Notes

Last updated: 2026-05-23

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

The graph write path remains fail-soft. Keep `ADVISOR_GRAPH_INGEST_ENABLED=false` unless the knowledge service is ready and you explicitly want advisory memory events written to the graph.
