# React Bits — Finance-OS

React Bits components are not used in the application, with one explicit
exception: the **login page background**.

The only file kept here is `pixel-blast.tsx` (WebGL pixel background), consumed
exclusively by `src/components/brand/pixel-blast-backdrop.tsx`, which is
rendered only on `/login`.

Origin: [React Bits (TS-Tailwind variant)](https://reactbits.dev/) by
**David Haz** — MIT + Commons Clause license, see
<https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md>.

Do not add new React Bits components. Build decorative needs with the current
Finance-OS design system.
