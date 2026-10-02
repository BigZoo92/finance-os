# Third-party notices

Attribution for third-party assets and libraries redistributed in this repository or in the built Finance-OS application. Update this file whenever an icon set, font, or vendored asset is added or removed.

## Pixel Icon Library (HackerNoon)

Finance-OS vendors a curated subset of the Pixel Icon Library, the catalogue published as "Pixel Icon" on <https://www.shadcn.io/icons/pixel>.

- Creator: HackerNoon
- Project: [Pixel Icon Library](https://github.com/hackernoon/pixel-icon-library) — <https://pixeliconlibrary.com>
- Icon files (`.svg`/`.png`): [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- Non-icon files in the upstream repository: MIT

CC BY 4.0 requires appropriate credit, a link to the licence, and an indication of whether changes were made.

**Changes made.** The `regular` SVGs were converted into typed React components under `packages/ui/src/icons/pixel/` by `scripts/vendor-pixel-icons.mjs`. Path geometry is preserved verbatim. The conversion drops the upstream `id`/`data-name` authoring attributes, sets `fill="currentColor"`, and exposes `width`/`height` through a `size` prop so icons inherit Finance-OS colour tokens.

## Phosphor Icons

- Project: [phosphor-icons/react](https://github.com/phosphor-icons/react)
- Package: `@phosphor-icons/react`
- Licence: MIT

Used unmodified, as a dependency of `apps/web`, for the small number of concepts the Pixel Icon set does not cover clearly.

## Tailwind CSS preflight

- Project: [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss)
- File: `preflight.css` from Tailwind CSS 4.3.3
- Licence: MIT

Vendored as `packages/ui/src/styles/preflight.css` so the element reset stays byte-for-byte what the product was designed on after the styling engine moved to Panda CSS. **Changes made.** The `--theme()` font lookups are replaced by the Finance-OS font tokens and the rules are wrapped in the `preflight` cascade layer; the explanatory comments are shortened.

## Pxlkit

- Project: [joangeldelarosa/pxlkit](https://github.com/joangeldelarosa/pxlkit)
- Code packages (`@pxlkit/core`, `@pxlkit/ui-kit`, `@pxlkit/voxel`): MIT
- Icon and visual assets: separately licensed under the upstream `LICENSE-ASSETS`, which requires attribution, with paid no-attribution terms in `COMMERCIAL_TERMS`

**Not currently installed or used.** Pxlkit is reserved for rare expressive surfaces. Before shipping any Pxlkit asset, re-read the upstream `LICENSE-ASSETS` and add the required attribution to this file.

## Related

Icon selection and implementation rules live in the `finance-os-icon-system` skill.
