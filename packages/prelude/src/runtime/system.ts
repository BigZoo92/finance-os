export type RuntimeServiceName = 'api' | 'web' | 'worker'

export type RuntimeFlagsPayload = {
  safeModeActive: boolean
}

export type RuntimeVersionPayload = {
  service: RuntimeServiceName
  GIT_SHA: string | null
  GIT_TAG: string | null
  BUILD_TIME: string | null
  NODE_ENV: string
  runtimeFlags: RuntimeFlagsPayload
}

export type RuntimeHealthPayload = {
  ok: true
  service: RuntimeServiceName
  runtimeFlags: RuntimeFlagsPayload
}

type RuntimeVersionInput = {
  service: RuntimeServiceName
  nodeEnv: string
  gitSha?: string | null | undefined
  gitTag?: string | null | undefined
  buildTime?: string | null | undefined
  appCommitSha?: string | null | undefined
  appVersion?: string | null | undefined
  safeModeActive?: boolean | undefined
}

const toOptionalEnv = (value: string | undefined | null) => {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export const buildRuntimeHealth = (service: RuntimeServiceName): RuntimeHealthPayload =>
  buildRuntimeHealthWithFlags(service, {})

export const buildRuntimeHealthWithFlags = (
  service: RuntimeServiceName,
  { safeModeActive = false }: { safeModeActive?: boolean | undefined }
): RuntimeHealthPayload => ({
  ok: true,
  service,
  runtimeFlags: {
    safeModeActive,
  },
})

export const resolveRuntimeVersion = ({
  service,
  nodeEnv,
  gitSha,
  gitTag,
  buildTime,
  appCommitSha,
  appVersion,
  safeModeActive = false,
}: RuntimeVersionInput): RuntimeVersionPayload => ({
  service,
  GIT_SHA: toOptionalEnv(gitSha) ?? toOptionalEnv(appCommitSha),
  GIT_TAG: toOptionalEnv(gitTag) ?? toOptionalEnv(appVersion),
  BUILD_TIME: toOptionalEnv(buildTime),
  NODE_ENV: nodeEnv,
  runtimeFlags: {
    safeModeActive,
  },
})
