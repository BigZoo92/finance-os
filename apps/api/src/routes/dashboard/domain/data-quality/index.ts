/**
 * Public surface of the `data-quality` bounded module. Code outside this folder
 * imports from here only (enforced by architecture-boundaries.test.ts).
 */
export { createGetDataQualityUseCase } from './create-get-data-quality-use-case'
export type { DataQualityResponse } from './data-quality-types'
