# Finance-OS Command Pixel V1

## Status

Command Pixel V1 FINAL is frozen and ready for implementation.

Do not explore alternate palettes, shells or global visual directions during implementation.

Canonical design frames are in `canonical/source/Finance-OS Command Pixel V1.dc.html`.

## Visual system

Palette: Soft Orange Cream.

Dark foundation:

- background `#242019`
- surface `#2C2720`
- floating surface `#302B23`
- cream `#F6F1E6`
- signal orange `#F97A3C`
- positive `#4CBB82`
- teal `#6FB5AA`
- negative `#E0685A`

Light foundation:

- background `#F5EFE3`
- ink `#221E17`
- orange `#DE5E1E`
- positive `#1C8A52`

Shell: contained floating navbar, maximum width 1240 px, visible margins, low radius, detached dropdowns and framed icon tiles.

Typography: Geist Sans for UI, Geist Mono for financial values and metadata, Geist Pixel only for rare micro-signature states.

Financial honesty: unknown values never become zero. Unavailable P&L remains unavailable.

## Copy system

Use French.

Show first. Explain on demand.

Every string must help the user understand, decide, act or identify an important state. Delete anything else.

Visible UI copy must never use the point médian, tiret cadratin or point-virgule punctuation styles.

Use spacing, columns, line breaks, separate labels, commas, colons and parentheses instead.

Never concatenate metadata into technical looking strings. Prefer separate visual labels.

Avoid fictional disclaimers, generic summary sections, AI narration, decorative prose and backend jargon.

## Hard product boundaries

- Advisor uses Action First hierarchy
- Radar observes and Advisor recommends
- Chat stays minimal
- Mémoire 3D never exposes raw graph infrastructure
- Orchestration is one job, one clear interaction
- Coûts measures and does not run jobs
- IBKR and Binance have zero credential UI
- Santé stays product level and does not become infrastructure monitoring
- Login uses no PixelBlast and no ReactBits

Read the remaining handoff documents before modifying UI.
