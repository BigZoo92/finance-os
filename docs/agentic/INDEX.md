# Agentic Index

Use these files as markdown-first entry points before re-exploring the repo.

## Maps

- [architecture-map.md](architecture-map.md): runtime entrypoints, package anchors, and where local rules live
- [contracts-map.md](contracts-map.md): required HTTP contracts and their implementation files
- [testing-map.md](testing-map.md): current automated coverage, scope-based verification, and manual gaps
- [ui-quality-map.md](ui-quality-map.md): UI quality bar, key surfaces, and manual UI checks
- [release-map.md](release-map.md): CI, autopilot, release, deploy, and smoke-test entrypoints
- [code_review.md](code_review.md): practical review severity and checklist for this repo
- [policy-verification-bundle.md](policy-verification-bundle.md): conventions, decision trees, and high-effort verification checklists for dual-path parity, observability, UI states, and rollback

## Local Guides

- Root contract: [../../AGENTS.md](../../AGENTS.md)
- API rules: [../../apps/api/AGENTS.md](../../apps/api/AGENTS.md)
- Web rules: [../../apps/web/AGENTS.md](../../apps/web/AGENTS.md)
- Worker rules: [../../apps/worker/AGENTS.md](../../apps/worker/AGENTS.md)
- Docker/deploy rules: [../../infra/docker/AGENTS.md](../../infra/docker/AGENTS.md)
- Package rules: [../../packages/db/AGENTS.md](../../packages/db/AGENTS.md), [../../packages/env/AGENTS.md](../../packages/env/AGENTS.md), [../../packages/powens/AGENTS.md](../../packages/powens/AGENTS.md), [../../packages/redis/AGENTS.md](../../packages/redis/AGENTS.md), [../../packages/ui/AGENTS.md](../../packages/ui/AGENTS.md), [../../packages/prelude/AGENTS.md](../../packages/prelude/AGENTS.md)

## Repo-Local Skills

- Skills live under [../../.agents/skills/](../../.agents/skills/).
- Start with [../../.agents/skills/repo-recall/SKILL.md](../../.agents/skills/repo-recall/SKILL.md) for orientation and then use the narrower skill that matches the task.

## Validation

- Agentic foundation validation: `node .agents/skills/scripts/validate-agent-foundation.mjs`
- Repo-wide verification commands remain in [../../package.json](../../package.json).
