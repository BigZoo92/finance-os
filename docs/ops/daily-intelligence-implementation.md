# Daily Intelligence Foundation Implementation

Last updated: 2026-05-23

## Implemented

- Social scheduler/API contract:
  - worker sends `trigger: "social_poll"`;
  - API accepts and logs it as `source: "social_scheduler"`;
  - validation errors are logged with scheduler, endpoint, status, request id, and safe validation body.
- Scheduler:
  - `DAILY_INTELLIGENCE_NIGHT_CRON`;
  - `DAILY_INTELLIGENCE_MORNING_CRON`;
  - `DAILY_INTELLIGENCE_DRY_RUN_DEFAULT`;
  - `DAILY_INTELLIGENCE_MANUAL_TRIGGER_ENABLED`;
  - next-run computation in `Europe/Paris` or configured timezone.
- Orchestrator:
  - `/ops/refresh/all` executes the `refresh-registry` daily plan;
  - `dryRun` returns the ordered plan with `pending`/`disabled` jobs;
  - job results include timing, records placeholders, retry count, and error fields.
- Observability:
  - `/ops/scheduler/status`;
  - `/ops/knowledge/enrichment/status`;
  - topological run history held in API process memory for this foundation pass.
- Free Firehose:
  - admin override requires `confirmation: true`, `overrideRequested: true`, and `confirmedRisk: true`;
  - override fields are persisted on `free_firehose_run`.
- Data contracts:
  - market valuation snapshots;
  - provider health snapshots;
  - FX rate snapshots;
  - Advisor investment recommendations;
  - market hypotheses;
  - prediction outcomes;
  - market post-mortems;
  - Advisor memory events.

## Important Env

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

Production must set `DAILY_INTELLIGENCE_ENABLED=true` on the worker when ready. Keep `false` until migrations are applied and `/ops/refresh/all` dry-run is verified.

## Recommended Deployment Check

1. Apply DB migration `0033_daily_intelligence_foundation.sql`.
2. Deploy API and worker with the new envs present.
3. Run `/ops/scheduler/status`.
4. Run `/ops/refresh/all` with `dryRun: true`.
5. Trigger `/dashboard/news/ingest` with `social_poll`.
6. Enable `DAILY_INTELLIGENCE_ENABLED=true` only after dry-run and social trigger are clean.

## Next Pass

- Persist topological runs in DB instead of process memory.
- Wire market providers into `asset_price_snapshot`.
- Generate account-scoped Advisor investment recommendations.
- Create hypotheses from accepted recommendations.
- Score outcomes on J+1/J+7/J+30.
- Write memory events into knowledge-service with run counters.
