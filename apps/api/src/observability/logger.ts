import {
  createJsonLogger,
  type JsonLogLevel,
  toErrorLogFields,
} from '@finance-os/prelude'

const apiLogger = createJsonLogger({ service: 'api' })

export const isApiDebugEnabled = () => {
  return apiLogger.getConfiguredLogLevel() === 'debug' || process.env.APP_DEBUG === '1'
}

export const logApiEvent = ({
  level,
  msg,
  ...fields
}: {
  level: JsonLogLevel
  msg: string
  [key: string]: unknown
}) => {
  apiLogger.logEvent({
    level,
    msg,
    ...fields,
  })
}

export { toErrorLogFields }
