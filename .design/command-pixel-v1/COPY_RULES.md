# Copy Rules

These rules are permanent for all Finance-OS UI.

## Core rule

Show first. Explain on demand.

Every visible string must help the user understand, decide, act or identify an important state. If it does none of these, delete it.

Whitespace is better than filler.

## Forbidden punctuation in UI copy

Never use the following punctuation styles in visible Finance-OS UI copy:

- point médian
- tiret cadratin
- point-virgule

Do not replace them with another decorative separator.

Prefer:

- spacing
- columns
- line breaks
- separate labels
- commas
- colons
- parentheses

## Metadata

Do not concatenate metadata into a technical looking sentence.

Bad pattern:

```text
IBKR [separator] ETF [separator] Socle
```

Preferred pattern:

```text
IBKR
ETF
Socle
```

Use layout and spacing to create structure.

## Tone

Use French.

Prefer:

- short labels
- amounts
- percentages
- states
- verbs
- short noun phrases

Avoid:

- AI narration
- filler copy
- decorative explanations
- fake intelligence language
- generic system commentary
- redundant subtitles
- backend jargon when a human label exists
- fictional disclaimers in the primary UI
- generic sections such as `À savoir` when they do not change the decision

## Advisor

Primary hierarchy:

1. amount
2. asset
3. destination
4. risk
5. action
6. optional short reason

Explanation remains secondary and appears on demand.

## Implementation QA

Before merging a UI change:

1. inspect all visible copy
2. remove forbidden punctuation styles
3. remove redundant prose
4. verify that no unknown financial value is displayed as zero
5. verify that technical implementation language is hidden unless explicitly useful
