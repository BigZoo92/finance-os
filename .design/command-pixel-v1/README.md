# Finance-OS Command Pixel V1

Final design handoff for engineering implementation.

## Status

Command Pixel V1 is visually frozen. Do not reopen palette, shell, typography or global art direction during implementation unless a real product or accessibility issue requires it.

## Install in the repository

Extract this ZIP at the root of the Finance-OS repository.

The resulting path is:

```text
.design/command-pixel-v1/
```

Keep this directory as the canonical design reference during the frontend refactor.

## Canonical source

The final Claude Design source is located at:

```text
canonical/source/Finance-OS Command Pixel V1.dc.html
```

Keep `support.js` beside it. The design file contains the final frames, the Design System, the navigation map, the page inventory and a clearly marked archive area.

Frames under `99 ARCHIVE` are not implementation references.

## What was intentionally excluded

The raw Claude export contained old inspiration images, Stitch explorations, rejected colorways and historical design files. They are not included here to prevent an implementation agent from mixing rejected directions with the final system.

See `archive/README.md`.

## Read before implementation

1. `DESIGN_SYSTEM.md`
2. `COPY_RULES.md`
3. `ROUTE_MAP.md`
4. `FRAME_INVENTORY.md`
5. `IMPLEMENTATION_RULES.md`
6. `IMPLEMENTATION_PHASES.md`

## Source of truth order

When references disagree, use this priority:

1. Final canonical screen in the Claude Design source
2. `DESIGN_SYSTEM.md`
3. `COPY_RULES.md`
4. `ROUTE_MAP.md`
5. Existing product behavior and real data constraints
6. Historical implementation

Do not use archived explorations as a visual source of truth.
