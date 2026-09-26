# @finance-os/styled-system

Panda CSS foundation for Finance-OS.

- `src/preset.ts` — the Command Pixel V1 design tokens as a Panda preset
  (semantic colors with light/dark values, radii ladder, fonts, motion,
  elevation, z-index scale, keyframes). This is the design-token source of
  truth; `packages/ui` and `apps/web` consume it through the generated runtime.
- `panda.config.ts` — the single Panda configuration. It extracts styles from
  `packages/ui/src` and `apps/web/src` and writes the runtime into `generated/`.
- `generated/` — output of `panda codegen` (gitignored). It is regenerated on
  `pnpm install` (`prepare`) and on `pnpm panda:codegen`; rerun the latter after
  changing the preset or the config.

Consumers import the runtime through the package export map:

```ts
import { css, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { hstack } from '@finance-os/styled-system/patterns'
```

Conventions live in the `panda-css` skill (`.agentic/source/skills/panda-css`).
