import { XMLParser } from 'fast-xml-parser'

export const newsXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
  parseTagValue: true,
})

export const ensureArray = <T>(value: T | T[] | null | undefined) => {
  if (Array.isArray(value)) {
    return value
  }

  return value === null || value === undefined ? [] : [value]
}

export const trimOrNull = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const fetchJson = async <T>({
  url,
  requestId,
  headers,
}: {
  url: string
  requestId: string
  headers?: Record<string, string>
}): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'x-request-id': requestId,
      ...headers,
    },
  })

  if (!response.ok) {
    throw new Error(`NEWS_PROVIDER_HTTP_${response.status}`)
  }

  return (await response.json()) as T
}

export const fetchText = async ({
  url,
  requestId,
  headers,
}: {
  url: string
  requestId: string
  headers?: Record<string, string>
}) => {
  const response = await fetch(url, {
    headers: {
      accept: 'application/xml,text/xml,text/plain,*/*',
      'x-request-id': requestId,
      ...headers,
    },
  })

  if (!response.ok) {
    throw new Error(`NEWS_PROVIDER_HTTP_${response.status}`)
  }

  return response.text()
}

export const sanitizePayload = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch {
    return null
  }
}

const splitCsvLine = (line: string) => {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
      continue
    }

    current += char
  }

  fields.push(current)
  return fields
}

export const parseCsvRows = (input: string) => {
  const lines = input
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = splitCsvLine(lines[0] ?? '')
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}
