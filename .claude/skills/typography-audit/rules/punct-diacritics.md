<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/typography-audit/rules/punct-diacritics.md
     Hash:   sha256:f508f4438d66f863
     Sync:   pnpm agent:skills:sync -->

---
title: Support Accented Characters and Diacritics
impact: CRITICAL
tags: diacritics, accents, unicode, utf-8, glyphs
---

## Support Accented Characters and Diacritics

Ensure chosen fonts include all necessary accented characters. Use correct diacritics (caf\u00e9, not cafe; na\u00efve, not naive). Store accents as Unicode characters, not as composed sequences. Avoid over-subsetting fonts, which can strip accented glyphs.

**Incorrect (missing diacritics, wrong encoding):**

```html
<meta charset="iso-8859-1">
<p>The cafe serves a prix fixe menu with creme brulee.</p>
```

**Correct (UTF-8 with proper diacritics):**

```html
<meta charset="utf-8">
<p>The caf&eacute; serves a prix fixe menu with cr&egrave;me br&ucirc;l&eacute;e.</p>
```

Verify glyph coverage before selecting a font. Test with content that includes characters from all target languages. Avoid font subsetting that removes accented character ranges.
