/**
 * Freezes wall-clock time in the SSR process for the visual regression run.
 *
 * Loaded through `NODE_OPTIONS=--import` by playwright.config.ts when
 * VISUAL_REGRESSION=1. Relative labels ("Ancien (216 j)") are computed from
 * `Date.now()` on the server and again on the client, so both clocks are
 * pinned to VISUAL_FIXED_TIME (the browser side is pinned through
 * `page.clock.setFixedTime` in e2e/visual-regression.spec.ts). Timers and
 * `performance.now()` keep running normally.
 */
const fixed = process.env.VISUAL_FIXED_TIME

if (fixed) {
  const fixedMs = new Date(fixed).getTime()
  if (Number.isNaN(fixedMs)) {
    throw new Error(`VISUAL_FIXED_TIME is not a valid date: ${fixed}`)
  }
  const RealDate = globalThis.Date
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixedMs)
      } else {
        super(...args)
      }
    }

    static now() {
      return fixedMs
    }
  }
  globalThis.Date = FixedDate
}
