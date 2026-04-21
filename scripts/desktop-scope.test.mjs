import assert from "node:assert/strict";
import test from "node:test";

import { detectDesktopScope, evaluateDesktopScope } from "./desktop-scope.mjs";

test("desktop scope matches desktop shell changes", () => {
  const result = evaluateDesktopScope([
    "apps/desktop/src-tauri/src/main.rs",
    "apps/api/src/index.ts",
  ]);

  assert.equal(result.required, true);
  assert.equal(result.matches[0]?.file, "apps/desktop/src-tauri/src/main.rs");
});

test("desktop scope matches web asset handoff changes", () => {
  const result = evaluateDesktopScope([
    "apps/web/public/logo.svg",
  ]);

  assert.equal(result.required, true);
  assert.match(result.matches[0]?.reason || "", /desktop bundle/i);
});

test("desktop scope ignores ordinary web source changes", () => {
  const result = evaluateDesktopScope([
    "apps/web/src/routes/index.tsx",
    "apps/api/src/index.ts",
  ]);

  assert.equal(result.required, false);
});

test("forced core mode disables desktop scope", () => {
  const result = detectDesktopScope({ mode: "core" });

  assert.equal(result.required, false);
  assert.equal(result.source, "forced");
});

test("forced desktop mode enables desktop scope", () => {
  const result = detectDesktopScope({ mode: "desktop" });

  assert.equal(result.required, true);
  assert.equal(result.source, "forced");
});
