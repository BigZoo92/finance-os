/**
 * Instant the visual regression run is pinned to, in the browser
 * (`page.clock.setFixedTime`) and in the SSR process (fixed-clock.mjs via
 * NODE_OPTIONS), so relative labels such as "Ancien (216 j)" never drift.
 */
export const VISUAL_FIXED_TIME = '2026-09-26T14:00:00.000Z'
