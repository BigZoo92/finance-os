export const AI_RUN_TERMINAL_STATUSES = ['completed', 'failed', 'degraded', 'skipped'] as const
export const AI_RUN_NON_TERMINAL_STATUSES = ['queued', 'running'] as const
export const AI_RUN_STATUSES = [
  ...AI_RUN_NON_TERMINAL_STATUSES,
  ...AI_RUN_TERMINAL_STATUSES,
] as const

export type AiRunStatus = (typeof AI_RUN_STATUSES)[number]
export type AiRunNonTerminalStatus = (typeof AI_RUN_NON_TERMINAL_STATUSES)[number]

export const isAiRunStatus = (status: string): status is AiRunStatus =>
  (AI_RUN_STATUSES as readonly string[]).includes(status)

export const isAiRunTerminalStatus = (status: AiRunStatus): boolean =>
  (AI_RUN_TERMINAL_STATUSES as readonly AiRunStatus[]).includes(status)

export const isAiRunActiveStatus = (status: AiRunStatus): boolean =>
  AI_RUN_NON_TERMINAL_STATUSES.includes(status as AiRunNonTerminalStatus)
