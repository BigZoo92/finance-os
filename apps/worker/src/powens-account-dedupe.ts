export type PowensAccountDedupeRow = {
  providerConnectionId: string
  powensAccountId: string
}

export type PowensAccountIbanRow = {
  iban: string | null
}

export const normalizePowensIban = (value: string | null | undefined) => {
  if (!value) {
    return null
  }

  const normalized = value.replace(/\s+/g, '').toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export const dedupePowensAccountRows = <TRow extends PowensAccountDedupeRow>(rows: TRow[]) => {
  if (rows.length <= 1) {
    return rows
  }

  const indexByKey = new Map<string, number>()
  const dedupedRows: TRow[] = []

  for (const row of rows) {
    const key = `${row.providerConnectionId}|${row.powensAccountId}`
    const existingIndex = indexByKey.get(key)

    if (existingIndex === undefined) {
      indexByKey.set(key, dedupedRows.length)
      dedupedRows.push(row)
      continue
    }

    dedupedRows[existingIndex] = row
  }

  return dedupedRows
}

export const collectNormalizedIbans = <TRow extends PowensAccountIbanRow>(rows: TRow[]) => {
  const ibans = new Set<string>()

  for (const row of rows) {
    const normalized = normalizePowensIban(row.iban)
    if (normalized) {
      ibans.add(normalized)
    }
  }

  return ibans
}
