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
- Investment Strategy Brain:
  - default `bigzoo_growth_60_30_10_v1` strategy seeding;
  - 60 / 30 / 10 bucket policy and account policies for PEA Trade Republic, IBKR, and Binance;
  - `investment-learning-review` job for due hypotheses, outcomes, post-mortems, lessons, and calibration;
  - `investment-action-plan` job for allocation, drift, account-aware plan, recommendations, hypotheses, memory events, and Advisor context enrichment;
  - `advisor-context` now depends on the investment action plan.

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
2. Apply DB migration `0034_investment_strategy_brain.sql`.
3. Deploy API and worker with the new envs present.
4. Run `/ops/scheduler/status`.
5. Run `/ops/refresh/all` with `dryRun: true`; verify `investment-learning-review` and `investment-action-plan` appear in order.
6. Trigger `/dashboard/news/ingest` with `social_poll`.
7. Trigger `/dashboard/advisor/investment-plan/generate` with `dryRun: true`.
8. Enable `DAILY_INTELLIGENCE_ENABLED=true` only after dry-run, social trigger, and investment-plan dry-run are clean.

## Next Pass

- Persist topological runs in DB instead of process memory.
- Wire market providers into `asset_price_snapshot`.
- Persist topological refresh runs in DB instead of process memory.
- Add admin UI for approving/rejecting asset-universe candidates.
- Add admin UI for approving/rejecting strategy lessons.
- Expand benchmark selection for hypothesis scoring.
