const MAX_SAMPLES = 200

const samples: number[] = []
const successRates: number[] = []

const percentile = (values: number[], p: number) => {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

export const recordBulkTriageMetrics = ({
  latencyMs,
  successRate,
}: {
  latencyMs: number
  successRate: number
}) => {
  samples.push(latencyMs)
  successRates.push(successRate)

  if (samples.length > MAX_SAMPLES) {
    samples.shift()
  }

  if (successRates.length > MAX_SAMPLES) {
    successRates.shift()
  }

  return {
    successRate,
    latencyP95Ms: percentile(samples, 95),
    rollingSuccessRate: successRates.reduce((acc, value) => acc + value, 0) / successRates.length,
  }
}
