import { estimateModelUsageCost } from '../pricing/registry'
import type {
  StructuredCompletionRequest,
  StructuredCompletionResult,
} from '../types'

const tryParseJson = <TOutput>(value: unknown): TOutput | null => {
  if (typeof value === 'object' && value !== null) {
    return value as TOutput
  }

  if (typeof value !== 'string') {
    return null
  }

  try {
    return JSON.parse(value) as TOutput
  } catch {
    return null
  }
}

const readOpenAiStructuredOutput = <TOutput>(payload: Record<string, unknown>) => {
  const direct = tryParseJson<TOutput>(payload.output_parsed)
  if (direct) {
    return direct
  }

  const text = tryParseJson<TOutput>(payload.output_text)
  if (text) {
    return text
  }

  const output = Array.isArray(payload.output) ? payload.output : []
  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const content = Array.isArray((item as { content?: unknown }).content)
      ? ((item as { content: unknown[] }).content)
      : []
    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue
      }

      const parsed = tryParseJson<TOutput>(
        (block as { parsed?: unknown; text?: unknown }).parsed ??
          (block as { text?: unknown }).text
      )
      if (parsed) {
        return parsed
      }
    }
  }

  throw new Error('OPENAI_STRUCTURED_OUTPUT_MISSING')
}

const readUsage = (payload: Record<string, unknown>) => {
  const usage =
    payload.usage && typeof payload.usage === 'object'
      ? (payload.usage as Record<string, unknown>)
      : {}
  const inputDetails =
    usage.input_tokens_details && typeof usage.input_tokens_details === 'object'
      ? (usage.input_tokens_details as Record<string, unknown>)
      : {}

  return {
    inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
    outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
    cachedInputTokens:
      typeof inputDetails.cached_tokens === 'number' ? inputDetails.cached_tokens : 0,
  }
}

export const createOpenAiResponsesClient = ({
  apiKey,
  baseUrl = 'https://api.openai.com/v1',
  fetchImpl = fetch,
  usdToEurRate = 0.92,
}: {
  apiKey: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  usdToEurRate?: number
}) => {
  return {
    async runStructured<TOutput>(
      request: StructuredCompletionRequest
    ): Promise<StructuredCompletionResult<TOutput>> {
      const startedAt = Date.now()
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/responses`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          input: request.userPrompt,
          instructions: request.systemPrompt,
          store: false,
          ...(request.reasoningEffort
            ? { reasoning: { effort: request.reasoningEffort } }
            : {}),
          ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
          text: {
            format: {
              type: 'json_schema',
              name: request.schemaName,
              strict: true,
              schema: request.schema,
            },
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`OPENAI_HTTP_${response.status}`)
      }

      const payload = (await response.json()) as Record<string, unknown>
      const usage = readUsage(payload)

      return {
        output: readOpenAiStructuredOutput<TOutput>(payload),
        usage: estimateModelUsageCost({
          provider: 'openai',
          model: request.model,
          feature: request.feature,
          endpointType: 'responses',
          status: 'completed',
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          latencyMs: Date.now() - startedAt,
          requestId:
            typeof payload.request_id === 'string' ? payload.request_id : null,
          responseId: typeof payload.id === 'string' ? payload.id : null,
          usdToEurRate,
          rawUsage: usage,
        }),
      }
    },
  }
}
