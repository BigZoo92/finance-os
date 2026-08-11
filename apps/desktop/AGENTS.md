# Desktop instructions

Scope: `apps/desktop/**`.

- Keep Tauri 2 a thin shell around `apps/web`; do not fork UI or finance logic.
- Preserve demo/admin behavior and least-privilege native permissions.
- Do not add shell, filesystem, or HTTP plugins without an explicit need and security review.
- Never expose secrets through `VITE_*` or desktop-only backdoors.
- `src-tauri/icons/icon.png` is canonical; generated platform icons are not edited by hand.

Verify with `pnpm desktop:doctor`, the relevant dev/build command, and full CI when prerequisites exist.
