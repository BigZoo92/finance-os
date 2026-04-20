const PATCH_MARKER = "AUTOPILOT_PATCH_V1";
const FOOTER_FIELDS = ["Status:", "What changed:", "Risk:", "Next:"];
const FENCED_BLOCK_REGEX = /```([a-zA-Z0-9_-]*)\s*[\r\n]([\s\S]*?)```/g;

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function invalid(reason) {
  return {
    valid: false,
    reason,
  };
}

function parseAutopilotPatchComment(body) {
  const normalizedBody = normalizeText(body);
  const fencedBlocks = [...normalizedBody.matchAll(FENCED_BLOCK_REGEX)];

  if (fencedBlocks.length !== 1) {
    return invalid("Expected exactly one fenced code block.");
  }

  const fencedBlock = fencedBlocks[0];
  const language = String(fencedBlock[1] || "").trim().toLowerCase();

  if (language && language !== "diff") {
    return invalid("Use a diff fence or an untyped fence only.");
  }

  const prefix = normalizedBody.slice(0, fencedBlock.index ?? 0).trim();
  if (prefix !== PATCH_MARKER) {
    return invalid("The patch marker must stay outside the code fence.");
  }

  let patchText = normalizeText(fencedBlock[2] || "");
  patchText = patchText.replace(/^\n+/, "").replace(/\n*$/, "\n");

  const firstMeaningfulLine =
    patchText.split("\n").find((line) => line.trim().length > 0) || "";
  if (!firstMeaningfulLine.startsWith("diff --git ")) {
    return invalid("The fenced block must start with diff --git.");
  }

  const footerText = normalizedBody
    .slice((fencedBlock.index ?? 0) + fencedBlock[0].length)
    .trim();
  if (!footerText) {
    return invalid("Expected the status footer after the diff block.");
  }

  const footerLines = footerText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const label of FOOTER_FIELDS) {
    if (!footerLines.some((line) => line.startsWith(label))) {
      return invalid(`Expected the footer to include ${label}`);
    }
  }

  return {
    valid: true,
    language,
    patchText,
    footerText,
  };
}

module.exports = {
  FOOTER_FIELDS,
  PATCH_MARKER,
  parseAutopilotPatchComment,
};
