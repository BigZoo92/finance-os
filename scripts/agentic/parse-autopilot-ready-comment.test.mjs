import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  parseAutopilotReadyComment,
} = require("./parse-autopilot-ready-comment.cjs");

test("accepts READY footer lines wrapped in markdown emphasis", () => {
  const comment = [
    "### Challenger options",
    "",
    "**Status: READY**",
    "**What changed:**",
    "- Option one",
    "**Risk: med** — rollout adds operational complexity.",
    "**Next:** Open the implement PR.",
  ].join("\n");

  const result = parseAutopilotReadyComment(comment);

  assert.equal(result.valid, true);
});

test("accepts plain READY footer lines with trailing markdown spacing", () => {
  const comment = [
    "Acknowledged",
    "",
    "Status: READY  ",
    "What changed:",
    "- Option one",
    "Risk: med — parser should still match.",
    "Next: Create the implement PR.",
  ].join("\n");

  const result = parseAutopilotReadyComment(comment);

  assert.equal(result.valid, true);
});

test("rejects comments without a full READY footer", () => {
  const comment = [
    "Acknowledged",
    "",
    "Status: READY",
    "Risk: med — parser should reject missing footer fields.",
    "Next: Create the implement PR.",
  ].join("\n");

  const result = parseAutopilotReadyComment(comment);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "Expected the footer to include What changed:");
});
