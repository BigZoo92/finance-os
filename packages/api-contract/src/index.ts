/**
 * Transport contract shared by the API and the web app.
 *
 * Rules: schemas and inferred types only (Zod 4), no runtime dependency
 * besides zod, no server-only imports, no secrets. `null` means unknown for
 * every monetary or valuation field; it is never coerced to 0.
 */
export * from './analytics'
export * from './dashboard'
export * from './goals'
export * from './investments'
export * from './markets'
export * from './valuation'
