export type DemoPersonaId = 'student' | 'freelancer' | 'family' | 'retiree'
export type DemoTransactionsScenario =
  | 'default'
  | 'empty'
  | 'subscriptions'
  | 'parse_error'
  | 'student_budget'
  | 'freelancer_cashflow'
  | 'family_planning'
  | 'retiree_stability'

export type PersonaMatchResult = {
  profile: string
  personaId: DemoPersonaId
  scenarioId: DemoTransactionsScenario
  boundedVariation: 0 | 1 | 2
  matchReason: string
}

const PERSONA_CATALOG: Array<{
  id: DemoPersonaId
  label: string
  keywords: string[]
  scenario: DemoTransactionsScenario
}> = [
  {
    id: 'student',
    label: 'Student',
    keywords: ['student', 'campus', 'intern', 'junior', 'study'],
    scenario: 'student_budget',
  },
  {
    id: 'freelancer',
    label: 'Freelancer',
    keywords: ['freelancer', 'independent', 'consultant', 'self employed', 'contractor'],
    scenario: 'freelancer_cashflow',
  },
  {
    id: 'family',
    label: 'Family',
    keywords: ['family', 'parents', 'kids', 'household', 'couple'],
    scenario: 'family_planning',
  },
  {
    id: 'retiree',
    label: 'Retiree',
    keywords: ['retiree', 'retired', 'pension', 'senior'],
    scenario: 'retiree_stability',
  },
]

const hashString = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const normalizeProfile = (value: string | null | undefined) => {
  const normalized = value?.trim().toLowerCase()
  return normalized && normalized.length > 0 ? normalized : 'default-profile'
}

export const getScenarioCatalog = () => {
  return PERSONA_CATALOG.map(entry => ({
    personaId: entry.id,
    personaLabel: entry.label,
    scenarioId: entry.scenario,
  }))
}

export const matchPersonaScenario = (profile: string | null | undefined): PersonaMatchResult => {
  const normalizedProfile = normalizeProfile(profile)
  if (PERSONA_CATALOG.length === 0) {
    throw new Error('Persona catalog is empty')
  }

  for (const persona of PERSONA_CATALOG) {
    if (persona.keywords.some(keyword => normalizedProfile.includes(keyword))) {
      return {
        profile: normalizedProfile,
        personaId: persona.id,
        scenarioId: persona.scenario,
        boundedVariation: (hashString(`${normalizedProfile}:${persona.id}`) % 3) as 0 | 1 | 2,
        matchReason: `keyword:${persona.id}`,
      }
    }
  }

  const index = hashString(normalizedProfile) % PERSONA_CATALOG.length
  const persona = PERSONA_CATALOG[index]
  if (!persona) {
    throw new Error('Persona selection failed')
  }

  return {
    profile: normalizedProfile,
    personaId: persona.id,
    scenarioId: persona.scenario,
    boundedVariation: (hashString(`${normalizedProfile}:${persona.id}`) % 3) as 0 | 1 | 2,
    matchReason: 'hash_fallback',
  }
}
