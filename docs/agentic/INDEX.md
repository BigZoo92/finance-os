# Agentic Index

Use these files as markdown-first entry points before re-exploring the repo.

## Maps

- [architecture-canonical.md](architecture-canonical.md): canonical runtime entrypoints, boundaries, and architecture doc template
- [contracts-canonical.md](contracts-canonical.md): canonical HTTP contract guidance and non-regression template
- [testing-canonical.md](testing-canonical.md): canonical verification strategy and evidence requirements
- [release-canonical.md](release-canonical.md): canonical CI/release/deploy guidance and rollout constraints
- [design-guidance-canonical.md](design-guidance-canonical.md): canonical UI/UX quality guidance with required state matrix template
- [execution-map.md](execution-map.md): end-to-end runtime flows for dashboard, Powens callback, and worker sync
- [code_review.md](code_review.md): practical review severity and checklist for this repo
- [policy-verification-bundle.md](policy-verification-bundle.md): conventions, decision trees, and high-effort verification checklists for dual-path parity, observability, UI states, and rollback

## Deprecated Redirect Stubs

- [architecture-map.md](architecture-map.md)
- [contracts-map.md](contracts-map.md)
- [testing-map.md](testing-map.md)
- [release-map.md](release-map.md)
- [ui-quality-map.md](ui-quality-map.md)

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
