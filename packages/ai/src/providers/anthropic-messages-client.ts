import { estimateModelUsageCost } from '../pricing/registry'
import type {
  StructuredCompletionRequest,
  StructuredCompletionResult,
} from '../types'

type AnthropicToolUseBlock = {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

const readToolUseOutput = <TOutput>(payload: Record<string, unknown>, schemaName: string) => {
  const content = Array.isArray(payload.content) ? payload.content : []
  for (const block of content) {
    if (!block || typeof block !== 'object') {
      continue
    }

    const candidate = block as Partial<AnthropicToolUseBlock>
    if (candidate.type === 'tool_use' && candidate.name === schemaName) {
      return candidate.input as TOutput
    }
  }

  throw new Error('ANTHROPIC_TOOL_USE_OUTPUT_MISSING')
}

export const createAnthropicMessagesClient = ({
  apiKey,
  baseUrl = 'https://api.anthropic.com/v1',
  anthropicVersion = '2023-06-01',
  fetchImpl = fetch,
  usdToEurRate = 0.92,
}: {
  apiKey: string
  baseUrl?: string
  anthropicVersion?: string
  fetchImpl?: typeof fetch
  usdToEurRate?: number
}) => {
  return {
    async runStructured<TOutput>(
      request: StructuredCompletionRequest
    ): Promise<StructuredCompletionResult<TOutput>> {
      const startedAt = Date.now()
      const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': anthropicVersion,
        },
        body: JSON.stringify({
          model: request.model,
          system: request.systemPrompt,
          max_tokens: request.maxOutputTokens ?? 2000,
          messages: [
            {
              role: 'user',
              content: request.userPrompt,
            },
          ],
          tools: [
            {
              name: request.schemaName,
              description: 'Return only the structured result requested by the caller.',
              input_schema: request.schema,
            },
          ],
          tool_choice: {
            type: 'tool',
            name: request.schemaName,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`ANTHROPIC_HTTP_${response.status}`)
      }

      const payload = (await response.json()) as Record<string, unknown>
      const usage =
        payload.usage && typeof payload.usage === 'object'
          ? (payload.usage as Record<string, unknown>)
          : {}

      return {
        output: readToolUseOutput<TOutput>(payload, request.schemaName),
        usage: estimateModelUsageCost({
          provider: 'anthropic',
          model: request.model,
          feature: request.feature,
          endpointType: 'messages',
          status: 'completed',
          inputTokens: typeof usage.input_tokens === 'number' ? usage.input_tokens : 0,
          outputTokens: typeof usage.output_tokens === 'number' ? usage.output_tokens : 0,
          cachedInputTokens:
            typeof usage.cache_read_input_tokens === 'number'
              ? usage.cache_read_input_tokens
              : 0,
          cacheWriteTokens:
            typeof usage.cache_creation_input_tokens === 'number'
              ? usage.cache_creation_input_tokens
              : 0,
          cacheDuration: request.promptCache ? '5m' : null,
          latencyMs: Date.now() - startedAt,
          requestId:
            typeof payload.id === 'string' ? payload.id : null,
          responseId: typeof payload.id === 'string' ? payload.id : null,
          usdToEurRate,
          rawUsage:
            Object.keys(usage).length > 0
              ? usage
              : null,
        }),
      }
    },
  }
}
