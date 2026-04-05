# Final Setup Checklist

Date: 2026-04-04

## 1. What changed

- Restored automatic implementation from `implement:` PR threads by adding `.github/workflows/autopilot-apply-codex-diff.yml`.
- Replaced the broken manual-handoff PR prompt with a PR-thread patch request in `.github/workflows/autopilot-improve-to-draft-pr.yml`.
- Rewired CI-failure follow-up to ask Codex for another PR-thread patch reply instead of telling it to push commits manually.
- Kept the single-lane queue model, but hardened `.github/workflows/autopilot-queue-pump.yml` so it can migrate legacy stuck `autopilot:waiting-codex` PRs and backfill the new implementation request.
- Upgraded the batch issue template and batch-to-spec workflows so rich batch product context now flows into spec generation and spec bodies.
- Added root `CLAUDE.md` and updated `AGENTS.md` so Codex/Claude ownership is explicit.
- Vendored `skill.color-expert` into `.agents/skills/color-expert/` and added a Claude wrapper at `.claude/skills/color-expert/SKILL.md`.
- Synced release/autopilot/docs guidance to the repaired workflow.

## 2. Why it was changed

- The current production blocker was not a small label bug. The repo had removed the only automated implement-stage consumer and replaced it with a manual pause.
- That left stub PRs open, closed the linked `spec:` and `improve:` issues, and blocked the only active implementation lane.
- The richer batch template changes reduce ambiguity and rework by carrying product intent forward instead of collapsing everything down to raw bullets only.
- The Codex/Claude docs reduce collisions and make the repo workable for both tools without inventing a second orchestration system.

## 3. What was broken and how it was fixed

Broken:

- `improve:` issue became `ready`
- draft `implement:` PR stub was created
- linked `spec:` / `improve:` issues were closed
- but no automated workflow remained to consume an implementation response on the PR thread
- the PR stayed stub-only and blocked the queue

Fix:

- restored a GitHub-native PR-thread patch-apply workflow
- changed the `implement:` PR handoff comment back to `AUTOPILOT_PATCH_V1`
- taught the queue pump to rescue legacy `autopilot:waiting-codex` PRs
- aligned CI-failure and merge-on-green messaging with the restored patch path

## 4. What remains optional

- A second implementation lane: not recommended by default and not enabled.
- More paid orchestration tooling: intentionally not added.
- Claude-driven PR-thread automation: intentionally not added.
- A fully automated upstream refresh script for `skill.color-expert`: not added; current vendored copy is stable and documented.
- Admin-targeted post-deploy smoke credentials: optional.
- Ops alert webhook: optional unless you enable `ALERTS_ENABLED=true`.
- Powens integration: optional unless you want real provider access beyond demo mode.

## 5. What you must do manually now

1. Push this branch to your default branch so the repaired workflows become live on GitHub.
2. Add or update the repository secret `GH_AUTOPILOT_TOKEN`.
3. Confirm your ChatGPT Pro / Codex GitHub connection still has access to this repository.
4. If the repo does not show up in ChatGPT/Codex, trigger GitHub indexing with a GitHub search for `repo:BigZoo92/finance-os import`, then wait about 5 to 10 minutes.
5. If you already have an old stuck stub PR carrying `autopilot:waiting-codex`, wait for the scheduled queue pump to migrate it. If it still does nothing, close that PR without merge so autopilot can reopen and requeue the linked work cleanly.
6. If you want release automation, confirm the Dokploy and smoke secrets/variables below are configured in GitHub.

## 6. Tokens, keys, secrets, and accounts you may need

### Required for the repaired agentic workflow

#### `GH_AUTOPILOT_TOKEN`

- Purpose: lets GitHub Actions create/update issues, comment on PRs, create branches/PRs, push patch-applied commits, and read CI run data.
- Required: yes for autopilot.
- Store in: GitHub repository secret `GH_AUTOPILOT_TOKEN`.
- How to generate:
  1. In GitHub, go to `Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token`.
  2. Set the resource owner to the user/org that owns this repo.
  3. Limit repository access to this repo.
  4. Grant at least these repository permissions:
     - `Contents: Read and write`
     - `Issues: Read and write`
     - `Pull requests: Read and write`
     - `Actions: Read`
  5. Generate the token and paste it into the repo secret.
- Notes:
  - If the repo is in an org that requires token approval, approve the token before expecting the workflows to work.
  - A GitHub App would be cleaner long-term, but the PAT is the lowest-friction fix and is already compatible with this repo.

### Required for Codex account access

#### ChatGPT Pro + Codex with GitHub access

- Purpose: services the `@codex` requests on batch/improve/implement PR threads.
- Required: yes for the remote GitHub autopilot loop.
- Store in: your ChatGPT/OpenAI account connection, not in the repo.
- How to set up:
  - Connect GitHub to ChatGPT/Codex in ChatGPT connected-app settings.
  - Ensure the ChatGPT GitHub connector is authorized for this repository.
  - If the repo is missing from ChatGPT, trigger indexing via `repo:BigZoo92/finance-os import` on GitHub and wait a few minutes.

### Required for release/deploy automation

#### `GHCR_IMAGE_NAME`

- Purpose: base image name for release publishing.
- Required: yes if you use `.github/workflows/release.yml`.
- Store in: GitHub repository variable `GHCR_IMAGE_NAME`.
- Value today: `ghcr.io/bigzoo92/finance-os`

#### `DOKPLOY_URL`

- Purpose: base Dokploy URL used by the release workflow.
- Required: yes if you use GitHub-driven deployment.
- Store in: GitHub repository secret `DOKPLOY_URL`.
- How to get it: your Dokploy base URL, for example `https://dokploy.example.com`.

#### `DOKPLOY_API_KEY`

- Purpose: authenticates `compose.one`, `compose.update`, and `compose.deploy`.
- Required: yes if you use GitHub-driven deployment.
- Store in: GitHub repository secret `DOKPLOY_API_KEY`.
- How to generate:
  - In Dokploy, go to your profile settings, open the API/CLI section, and generate an API key.

#### `DOKPLOY_COMPOSE_ID`

- Purpose: tells the release workflow which Compose service to update/deploy.
- Required: yes if you use GitHub-driven deployment.
- Store in: GitHub repository secret `DOKPLOY_COMPOSE_ID`.
- How to get it:
  - Copy the Compose service identifier from the Dokploy service you want this repo to deploy.
  - If needed, verify it by calling Dokploy `compose.one` with the same value.

### Optional GitHub release/smoke settings

#### `SMOKE_ADMIN_EMAIL`

- Purpose: admin-mode production smoke login.
- Required: optional.
- Store in: GitHub repository secret `SMOKE_ADMIN_EMAIL`.

#### `SMOKE_ADMIN_PASSWORD`

- Purpose: admin-mode production smoke login password.
- Required: optional.
- Store in: GitHub repository secret `SMOKE_ADMIN_PASSWORD`.

#### `SMOKE_AUTH_MODE`

- Purpose: tells prod smoke whether to assert demo, admin, or auto mode.
- Required: optional.
- Store in: GitHub repository variable `SMOKE_AUTH_MODE`.

#### `SMOKE_SUMMARY_RANGE`

- Purpose: smoke parameter for dashboard summary range.
- Required: optional.
- Store in: GitHub repository variable `SMOKE_SUMMARY_RANGE`.

### Required runtime app secrets for real admin / production

Store these in Dokploy Compose env for production, and locally in `.env` / `.env.prod.local` for development only.

#### `AUTH_ADMIN_PASSWORD_HASH_B64`

- Purpose: canonical admin password hash.
- Required: yes for real admin login.
- Store in: Dokploy Compose env / local `.env`.
- How to generate: run `pnpm auth:hash-b64` and paste the resulting base64 hash.

#### `AUTH_SESSION_SECRET`

- Purpose: signs the admin session cookie.
- Required: yes.
- Store in: Dokploy Compose env / local `.env`.
- How to generate: use a password manager secret or `openssl rand -base64 48`.

#### `APP_ENCRYPTION_KEY`

- Purpose: encrypts Powens tokens at rest.
- Required: yes if Powens is enabled; recommended regardless so prod is ready.
- Store in: Dokploy Compose env / local `.env`.
- How to generate: `openssl rand -hex 32`

#### `POSTGRES_PASSWORD` and `DATABASE_URL`

- Purpose: database auth.
- Required: yes for admin mode / persistence.
- Store in: Dokploy Compose env / local `.env`.
- How to generate: strong random DB password from your password manager.

### Optional runtime server-only secrets

#### `PRIVATE_ACCESS_TOKEN`

- Purpose: server-to-server auth barrier for internal SSR/tooling calls.
- Required: optional.
- Store in: Dokploy Compose env / local `.env`.
- How to generate: password manager secret or `openssl rand -hex 32`.

#### `DEBUG_METRICS_TOKEN`

- Purpose: protects debug/metrics endpoints.
- Required: optional.
- Store in: Dokploy Compose env / local `.env`.
- How to generate: password manager secret or `openssl rand -hex 32`.

### Required only if you enable Powens

#### `POWENS_CLIENT_ID`

- Purpose: Powens API client identifier.
- Required: only if using Powens in admin mode.
- Store in: Dokploy Compose env / local `.env`.
- How to get it: from your Powens developer/dashboard account.

#### `POWENS_CLIENT_SECRET`

- Purpose: Powens API client secret.
- Required: only if using Powens in admin mode.
- Store in: Dokploy Compose env / local `.env`.
- How to get it: from your Powens developer/dashboard account.

#### `POWENS_BASE_URL`, `POWENS_DOMAIN`, `POWENS_REDIRECT_URI_PROD`

- Purpose: Powens tenant/runtime configuration.
- Required: only if using Powens.
- Store in: Dokploy Compose env / local `.env`.
- How to get it: from Powens dashboard / tenant setup.

### Optional ops alerting

#### `ALERTS_WEBHOOK_URL`

- Purpose: receives minimal ops alerts from the `ops-alerts` sidecar.
- Required: optional unless `ALERTS_ENABLED=true`.
- Store in: Dokploy Compose env.
- How to get it: incoming webhook URL from ntfy, Slack, Mattermost, Discord, or your private webhook sink.

#### `ALERTS_WEBHOOK_HEADERS_JSON`

- Purpose: optional auth headers for the alert webhook.
- Required: optional.
- Store in: Dokploy Compose env.
- How to generate: small JSON object with headers, for example bearer auth.

### Optional Dokploy GHCR registry credential

#### GHCR `read:packages` token for Dokploy

- Purpose: lets Dokploy pull private GHCR images.
- Required: only if GHCR packages are private.
- Store in: Dokploy registry config, not in this repo.
- How to generate: GitHub token with package read access for the image owner.

## 7. Required vs optional summary

Required for remote autopilot:

- ChatGPT Pro + Codex with GitHub access
- `GH_AUTOPILOT_TOKEN`

Required for release automation:

- `GHCR_IMAGE_NAME`
- `DOKPLOY_URL`
- `DOKPLOY_API_KEY`
- `DOKPLOY_COMPOSE_ID`

Required for real admin/prod runtime:

- `AUTH_ADMIN_PASSWORD_HASH_B64`
- `AUTH_SESSION_SECRET`
- DB credentials / `DATABASE_URL`

Required only if using Powens:

- `POWENS_CLIENT_ID`
- `POWENS_CLIENT_SECRET`
- `POWENS_BASE_URL`
- `POWENS_DOMAIN`
- `POWENS_REDIRECT_URI_PROD`
- `APP_ENCRYPTION_KEY`

Optional:

- `PRIVATE_ACCESS_TOKEN`
- `DEBUG_METRICS_TOKEN`
- `SMOKE_ADMIN_EMAIL`
- `SMOKE_ADMIN_PASSWORD`
- `SMOKE_AUTH_MODE`
- `SMOKE_SUMMARY_RANGE`
- `ALERTS_*`
- Dokploy GHCR registry token if packages are private

## 8. Features intentionally disabled by default to avoid extra cost or chaos

- No extra paid orchestrator or pay-per-use automation product.
- No second implementation lane by default.
- No Claude-driven automated PR writer on the GitHub loop.
- No mandatory admin smoke credentials.
- No mandatory alert webhook.
- No mandatory Powens integration in order to keep demo mode usable and cheap.

## 9. How to use Codex day to day in this repo

1. Create a rich `batch:` issue using the expanded template.
2. Label it `ready`.
3. Let autopilot spawn `spec:` issues, run the `improve:` challenger step, and open the draft `implement:` PR.
4. Treat the `implement:` PR as the only execution artifact.
5. Let Codex reply on that PR thread with `AUTOPILOT_PATCH_V1`.
6. Let autopilot apply the patch, run CI, and merge on green.
7. If CI fails, keep Codex on the same PR thread. Do not restart from the issue.

Do not:

- manually extract from `improve:` issues
- open a second PR from an autopilot `implement:` task
- have multiple writers editing the active autopilot branch at the same time

## 10. How to use Claude day to day in this repo

- Use Claude as reviewer, challenger, and local high-context collaborator by default.
- Ask Claude to attack assumptions, review diffs, validate architecture decisions, or improve prompts/spec quality.
- Use Claude for local implementation only when you intentionally take ownership of a branch.
- Keep Claude off the active autopilot PR branch unless you are explicitly doing a human takeover.

## 11. How to use Codex and Claude together without collisions

- Default rule: Codex writes, Claude reviews.
- If Claude must implement, make that an explicit human takeover on the same branch.
- Never let both write concurrently to the same active autopilot `agent/impl-*` branch.
- Keep one writer and one reviewer/challenger role at a time on the active autopilot item.

## 12. How to use the color skill

Canonical paths:

- Codex / repo-managed universal skill: `.agents/skills/color-expert/`
- Claude wrapper: `.claude/skills/color-expert/SKILL.md`

Installer note:

- `npx skills add meodai/skill.color-expert` was attempted first.
- In this environment it dropped into an interactive selection flow instead of completing a deterministic repo install.
- The repo therefore vendors a stable canonical copy directly under `.agents/skills/color-expert/`.

Use it when the task involves:

- palette direction
- theme/color-system design
- contrast/accessibility
- gradients, ramps, or scale generation
- color naming/conversion/explanation
- print-vs-screen or pigment-mixing questions

Update flow:

1. Re-run `npx skills add meodai/skill.color-expert` if the CLI becomes usable in your setup.
   Expected result: the canonical `.agents/skills/color-expert/` copy is refreshed in place.
2. Or pull the upstream repo and refresh `.agents/skills/color-expert/`.
3. Keep `.claude/skills/color-expert/SKILL.md` pointing at the canonical copy.

Caveat:

- The repo now vendors the upstream skill content once under `.agents/skills/color-expert/`. The Claude side is a wrapper, not a second full mirror.

## 13. Workflow change I recommend

Keep the current product-oriented model.

Recommended change:

- keep `batch -> spec -> improve -> implement PR -> merge`
- keep GitHub as the orchestrator
- keep one implementation lane by default
- restore PR-thread patch apply as the remote happy path
- keep Claude as reviewer/challenger by default, not the second remote writer

This preserves what is good while removing the manual hole that broke the lane.

## 14. Troubleshooting tips

- If an `implement:` PR is stuck stub-only, check whether the PR thread contains the `AUTOPILOT_IMPLEMENTATION_REQUEST_V3` comment and whether Codex replied with `AUTOPILOT_PATCH_V1`.
- If a legacy PR still says `autopilot:waiting-codex`, wait for the queue pump to migrate it, or close it without merge to requeue cleanly.
- If Codex does not see the repo, reconnect GitHub to ChatGPT/Codex and trigger `repo:BigZoo92/finance-os import`.
- If patch apply fails, the PR thread now gets a failure reason. Fix the patch format on the same PR thread.
- If CI fails, treat the PR-thread CI summary as the source of truth, not a partial local Codex summary.
- If you need to take over locally, use `scripts/codex-env-setup.sh` first, then run `pnpm check:ci` before declaring the branch ready.

## 15. Vendor references

- GitHub fine-grained PAT creation: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- GitHub PAT permissions reference: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- Dokploy API token generation: https://docs.dokploy.com/docs/api
- OpenAI Codex with ChatGPT plans: https://help.openai.com/en/articles/11369540/
- OpenAI GitHub connection / indexing note: https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt
