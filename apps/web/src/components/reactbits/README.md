# React Bits — Finance-OS (residual)

Decision (RESET-AUDIT-CLEANUP-0): ReactBits components are banned from the
application, with one explicit exception — the **Login page background**.

The only file kept here is `pixel-blast.tsx` (WebGL pixel background), consumed
exclusively by `src/components/brand/pixel-blast-backdrop.tsx`, which is
rendered only on `/login`.

Origin: [React Bits (TS-Tailwind variant)](https://reactbits.dev/) by
**David Haz** — MIT + Commons Clause license, see
<https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md>.

Do not add new ReactBits components. Decorative needs go through the design
system built in the UI refonte phases.
