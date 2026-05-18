# X / Twitter — operational runbook

## Why this is sensitive

X recent-search is a **pay-per-use** API. Each post read costs money;
each user lookup costs money. Finance-OS gates X scraping behind budget
caps and a manual-confirmation flow to make sure operators are aware of
spend before it happens.

## Service ownership

X scraping runs **on the API container** (the worker schedules and posts
to `/dashboard/signals/x-twitter/daily-previous-day-sync`). All X-specific
secrets live on the API:

- `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` (the bearer)
- `X_DAILY_BUDGET_USD`, `X_MONTHLY_BUDGET_USD` (caps)
- `X_MAX_*` (per-day post/user/page caps)
- `X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD`
- `X_DISABLE_ON_BUDGET_EXCEEDED`, `X_DISABLE_ON_PAYMENT_REQUIRED`

The worker carries only scheduler config:
`X_DAILY_PREVIOUS_DAY_SYNC_ENABLED`, `X_DAILY_PREVIOUS_DAY_CRON`,
`X_DAILY_PREVIOUS_DAY_TIMEZONE`, lock TTL, trigger timeout.

> If `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` is missing from the worker
> container, **that is correct**. Only the API needs it.

## Diagnosing "X scheduler started but no posts ingested"

1. `GET /ops/env/diagnostics` → look for the X feature row. If
   `canRun=false` with `reasonIfBlocked` mentioning `BEARER_TOKEN` or
   `X_*_BUDGET_USD`, fix the env in Dokploy and redeploy.
2. `GET /dashboard/signals/x-twitter/health` → returns budget remaining,
   last run, last error.
3. If `canRun=true` but the daily run errored, check
   `/ops/refresh/runs/:runId` for the last `tweets-finance` /
   `tweets-ai` / X manual run.
4. Common failures:
   - `payment_required` from X API → top up the account; the system will
     auto-disable until `X_DISABLE_ON_PAYMENT_REQUIRED=false`.
   - `query_too_long` → `NEWS_PROVIDER_X_TWITTER_QUERY` exceeds X's
     512-character recent-search limit; trim.
   - `budget_exceeded` → today's or this month's cap was hit; status maps
     to `skipped_budget`. Bump the cap or wait until next reset.

## Manual run

Page `/signaux/x-twitter` (admin-only) exposes the manual rerun button.
The button calls
`POST /dashboard/signals/x-twitter/daily-previous-day-sync` with
`runMode: 'manual_full_previous_day'` and `manualConfirm: true`.

If the estimate exceeds
`X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD`, the user must
confirm with `allowBudgetOverride: true`.

## What to set in the X Developer Portal

1. Create a Project + App.
2. Enable **Twitter API v2** and request **Pro tier** (Free tier blocks
   recent-search beyond very low limits).
3. Generate a **bearer token** with at least `tweet.read` and
   `users.read` scopes.
4. Set the bearer in Dokploy as `NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN` on
   the **api** service only.
5. Verify it works by hitting `GET /dashboard/signals/x-twitter/health`
   in admin mode — `lastError` should be null.
