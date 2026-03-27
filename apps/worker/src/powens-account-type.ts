import type { PowensAccount } from '@finance-os/powens'

const INVESTMENT_TYPE_HINTS = [
  'investment',
  'market',
  'security',
  'portfolio',
  'stock',
  'bond',
  'fund',
  'pea',
  'per',
  'titres',
  'assurance vie',
  'assurance-vie',
  'life insurance',
] as const

const normalizeAccountTypeToken = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

const isInvestmentAccountType = (value: string | null) => {
  if (!value) {
    return false
  }

  const normalized = normalizeAccountTypeToken(value)

  return INVESTMENT_TYPE_HINTS.some(hint => normalized.includes(hint))
}

export const resolveAssetTypeFromPowensAccountType = (
  value: PowensAccount['type']
): 'cash' | 'investment' => {
  if (typeof value === 'string') {
    return isInvestmentAccountType(value) ? 'investment' : 'cash'
  }

  if (value && typeof value === 'object') {
    const objectTypeHints = [value.id, value.name]
      .filter((hint): hint is string => typeof hint === 'string' && hint.length > 0)
      .some(hint => isInvestmentAccountType(hint))

    return objectTypeHints ? 'investment' : 'cash'
  }

  return 'cash'
}
