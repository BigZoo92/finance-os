import type {
  DashboardInvestmentStrategyProfile,
  DashboardInvestmentStrategyUpdateInput,
} from './dashboard-types'

export const INVESTMENT_RISK_PROFILES = [
  'conservative',
  'balanced',
  'growth',
  'aggressive',
  'custom',
] as const satisfies readonly DashboardInvestmentStrategyProfile['riskProfile'][]

export type InvestmentProfileFormDraft = {
  description?: string
  horizonYears?: string
  riskProfile?: string
  monthlyContributionTarget?: string
  rebalanceThresholdPct?: string
}

export type InvestmentProfileFormErrors = Partial<Record<keyof InvestmentProfileFormDraft, string>>

export type InvestmentProfileFormBuildResult =
  | { ok: true; input: DashboardInvestmentStrategyUpdateInput }
  | { ok: false; errors: InvestmentProfileFormErrors }

const isRiskProfile = (
  value: string
): value is DashboardInvestmentStrategyProfile['riskProfile'] => {
  return (INVESTMENT_RISK_PROFILES as readonly string[]).includes(value)
}

const parseNumber = (value: string) => {
  const normalized = value.trim()
  if (normalized.length === 0) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const TECHNICAL_PROFILE_COPY_PATTERN =
  /\b(?:backend|base de donn[ée]es|database|db|d[ée]mo d[ée]terministe|finance-engine|llm|provider)\b|\bmod(?:el|[èe]le)\s+(?:ai|ia|llm|gpt|claude)\b/i

export const toHumanInvestmentProfileDescription = (value: string): string => {
  const normalized = value
    .replace(/\s*[·—]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/,\s*$/, '')
    .trim()

  if (TECHNICAL_PROFILE_COPY_PATTERN.test(normalized)) {
    return 'Profil d’investissement personnalisé.'
  }
  return normalized
}

export const createInvestmentProfileFormDraft = (
  profile: DashboardInvestmentStrategyProfile
): Required<InvestmentProfileFormDraft> => ({
  description: toHumanInvestmentProfileDescription(profile.description),
  horizonYears: String(profile.horizonYears),
  riskProfile: profile.riskProfile,
  monthlyContributionTarget:
    profile.monthlyContributionTarget === null ? '' : String(profile.monthlyContributionTarget),
  rebalanceThresholdPct: String(profile.rebalanceThresholdPct),
})

export const validateInvestmentProfileFormDraft = (
  draft: InvestmentProfileFormDraft
): InvestmentProfileFormErrors => {
  const errors: InvestmentProfileFormErrors = {}

  if (
    draft.description !== undefined &&
    (draft.description.length < 1 || draft.description.length > 2000)
  ) {
    errors.description = 'La description doit contenir entre 1 et 2 000 caractères.'
  }

  if (draft.horizonYears !== undefined) {
    const horizonYears = parseNumber(draft.horizonYears)
    if (horizonYears === null || horizonYears < 1 || horizonYears > 80) {
      errors.horizonYears = 'L’horizon doit être compris entre 1 et 80 ans.'
    }
  }

  if (draft.riskProfile !== undefined && !isRiskProfile(draft.riskProfile)) {
    errors.riskProfile = 'Sélectionnez un profil de risque valide.'
  }

  if (draft.monthlyContributionTarget !== undefined) {
    const normalized = draft.monthlyContributionTarget.trim()
    const monthlyContributionTarget = parseNumber(draft.monthlyContributionTarget)
    if (
      normalized.length > 0 &&
      (monthlyContributionTarget === null ||
        monthlyContributionTarget < 0 ||
        monthlyContributionTarget > 1_000_000)
    ) {
      errors.monthlyContributionTarget =
        'Le versement mensuel doit être compris entre 0 et 1 000 000.'
    }
  }

  if (draft.rebalanceThresholdPct !== undefined) {
    const rebalanceThresholdPct = parseNumber(draft.rebalanceThresholdPct)
    if (rebalanceThresholdPct === null || rebalanceThresholdPct < 1 || rebalanceThresholdPct > 50) {
      errors.rebalanceThresholdPct = 'Le seuil de rééquilibrage doit être compris entre 1 et 50 %.'
    }
  }

  return errors
}

export const buildInvestmentStrategyUpdateInput = (
  draft: InvestmentProfileFormDraft,
  options: { sourceDescription?: string } = {}
): InvestmentProfileFormBuildResult => {
  const errors = validateInvestmentProfileFormDraft(draft)
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const input: DashboardInvestmentStrategyUpdateInput = {}

  if (draft.description !== undefined) {
    const sourceDescription = options.sourceDescription
    const unchangedPresentedDescription =
      sourceDescription !== undefined &&
      draft.description !== sourceDescription &&
      draft.description === toHumanInvestmentProfileDescription(sourceDescription)
    if (!unchangedPresentedDescription) input.description = draft.description
  }
  if (draft.horizonYears !== undefined) input.horizonYears = Number(draft.horizonYears.trim())
  if (draft.riskProfile !== undefined && isRiskProfile(draft.riskProfile)) {
    input.riskProfile = draft.riskProfile
  }
  if (draft.monthlyContributionTarget !== undefined) {
    const normalized = draft.monthlyContributionTarget.trim()
    input.monthlyContributionTarget = normalized.length === 0 ? null : Number(normalized)
  }
  if (draft.rebalanceThresholdPct !== undefined) {
    input.rebalanceThresholdPct = Number(draft.rebalanceThresholdPct.trim())
  }

  return { ok: true, input }
}
