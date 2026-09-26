/**
 * Public surface of the `trading-lab` bounded module. Code outside this folder
 * imports from here only (enforced by architecture-boundaries.test.ts).
 */
export {
  createHypothesisUseCases,
  isHypothesisValidationError,
} from './hypotheses/create-hypothesis-use-cases'
export { isHypothesisExecutionInstructionError } from './hypotheses/detect-execution-instruction'
export type {
  StrategyScorecardInputBacktestRun,
  StrategyScorecardInputStrategy,
} from './scorecard/compute-strategy-scorecard'
export {
  buildDemoStrategyScorecard,
  createStrategyScorecardUseCase,
} from './scorecard/compute-strategy-scorecard'
