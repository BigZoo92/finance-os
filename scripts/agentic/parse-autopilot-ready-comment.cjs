const READY_STATUS_REGEX = /^\s*(?:[*_`]+\s*)?status\s*:\s*ready\b/i;
const READY_FOOTER_FIELDS = ["Status:", "What changed:", "Risk:", "Next:"];

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeReadyLine(line) {
  return String(line ?? "").replace(/[*_`]/g, "").trim();
}

function invalid(reason) {
  return {
    valid: false,
    reason,
  };
}

function parseAutopilotReadyComment(body) {
  const normalizedBody = normalizeText(body);
  const footerLines = normalizedBody
    .split("\n")
    .map(normalizeReadyLine)
    .filter(Boolean);

  if (!footerLines.some((line) => READY_STATUS_REGEX.test(line))) {
    return invalid("Expected a Status: READY footer line.");
  }

  for (const label of READY_FOOTER_FIELDS) {
    const normalizedLabel = normalizeReadyLine(label);
    if (!footerLines.some((line) => line.startsWith(normalizedLabel))) {
      return invalid(`Expected the footer to include ${label}`);
    }
  }

  return {
    valid: true,
    footerLines,
  };
}

module.exports = {
  READY_FOOTER_FIELDS,
  READY_STATUS_REGEX,
  parseAutopilotReadyComment,
};
