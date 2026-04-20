import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseAutopilotPatchComment,
} = require("./parse-autopilot-patch-comment.cjs");

function makeValidComment(patchText) {
  return [
    "AUTOPILOT_PATCH_V1",
    "",
    "```diff",
    patchText,
    "```",
    "",
    "Status: READY",
    "What changed: parser regression coverage added.",
    "Risk: low - comment parsing only.",
    "Next: let autopilot apply the patch.",
  ].join("\n");
}

test("accepts a valid comment even when the diff content mentions the patch marker", () => {
  const comment = makeValidComment(
    [
      "diff --git a/docs/example.md b/docs/example.md",
      "index 1111111..2222222 100644",
      "--- a/docs/example.md",
      "+++ b/docs/example.md",
      "@@ -1 +1,2 @@",
      " existing line",
      "+Mention AUTOPILOT_PATCH_V1 in the docs without tripping the parser.",
    ].join("\n"),
  );

  const result = parseAutopilotPatchComment(comment);

  assert.equal(result.valid, true);
  assert.match(result.patchText, /\+Mention AUTOPILOT_PATCH_V1/);
});

test("rejects comments where the marker appears only inside the diff fence", () => {
  const comment = [
    "```diff",
    "diff --git a/docs/example.md b/docs/example.md",
    "index 1111111..2222222 100644",
    "--- a/docs/example.md",
    "+++ b/docs/example.md",
    "@@ -1 +1,2 @@",
    " existing line",
    "+AUTOPILOT_PATCH_V1",
    "```",
    "",
    "Status: READY",
    "What changed: marker is misplaced.",
    "Risk: low - parser only.",
    "Next: regenerate the comment.",
  ].join("\n");

  const result = parseAutopilotPatchComment(comment);

  assert.equal(result.valid, false);
  assert.equal(
    result.reason,
    "The patch marker must stay outside the code fence.",
  );
});

test("rejects comments without the required footer fields", () => {
  const comment = [
    "AUTOPILOT_PATCH_V1",
    "",
    "```diff",
    "diff --git a/docs/example.md b/docs/example.md",
    "index 1111111..2222222 100644",
    "--- a/docs/example.md",
    "+++ b/docs/example.md",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "```",
    "",
    "Status: READY",
    "Risk: low - parser only.",
    "Next: regenerate the comment.",
  ].join("\n");

  const result = parseAutopilotPatchComment(comment);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Expected the footer to include What changed:");
});
