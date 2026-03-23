import {
  createJsonLogger,
  type JsonLogLevel,
  toErrorLogFields,
} from '@finance-os/prelude'

const workerLogger = createJsonLogger({ service: 'worker' })

export const logWorkerEvent = ({
  level,
  msg,
  ...fields
}: {
  level: JsonLogLevel
  msg: string
  [key: string]: unknown
}) => {
  workerLogger.logEvent({
    level,
    msg,
    ...fields,
  })
}

export { toErrorLogFields }
