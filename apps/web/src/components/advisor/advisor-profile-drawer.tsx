import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
} from '@finance-os/ui/components'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import type {
  DashboardInvestmentStrategyBucket,
  DashboardInvestmentStrategyProfile,
  DashboardInvestmentStrategyUpdateInput,
} from '@/features/dashboard-types'
import {
  buildInvestmentStrategyUpdateInput,
  createInvestmentProfileFormDraft,
  type InvestmentProfileFormDraft,
  type InvestmentProfileFormErrors,
} from '@/features/investment-profile-form'
import {
  advisorAllocationComparison,
  INVESTMENT_BUCKET_LABEL,
} from '@/features/investment-strategy-view-model'

const RISK_PROFILE_OPTIONS = [
  { value: 'conservative', label: 'Prudent' },
  { value: 'balanced', label: 'Équilibré' },
  { value: 'growth', label: 'Dynamique' },
  { value: 'aggressive', label: 'Offensif' },
  { value: 'custom', label: 'Personnalisé' },
] as const

type AdvisorProfileDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: DashboardInvestmentStrategyProfile | null
  buckets: DashboardInvestmentStrategyBucket[]
  isAdmin: boolean
  isPending: boolean
  mutationError: boolean
  onSubmit: (input: DashboardInvestmentStrategyUpdateInput) => void
}

const fieldErrorId = (field: keyof InvestmentProfileFormDraft) => `advisor-profile-${field}-error`

export function AdvisorProfileDrawer({
  open,
  onOpenChange,
  profile,
  buckets,
  isAdmin,
  isPending,
  mutationError,
  onSubmit,
}: AdvisorProfileDrawerProps) {
  const [draft, setDraft] = useState<InvestmentProfileFormDraft>({})
  const [errors, setErrors] = useState<InvestmentProfileFormErrors>({})
  const target = advisorAllocationComparison({ buckets, plan: null })

  useEffect(() => {
    if (!open || !profile) return
    setDraft(createInvestmentProfileFormDraft(profile))
    setErrors({})
  }, [open, profile])

  const update = (field: keyof InvestmentProfileFormDraft, value: string) => {
    setDraft(current => ({ ...current, [field]: value }))
    setErrors(current => {
      if (current[field] === undefined) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildInvestmentStrategyUpdateInput(
      draft,
      profile ? { sourceDescription: profile.description } : {}
    )
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    onSubmit(result.input)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" aria-busy={isPending}>
        <form className="flex min-h-full flex-col" onSubmit={handleSubmit} noValidate>
          <DrawerHeader className="border-b border-border/60 pb-5">
            <DrawerTitle>Profil d’investissement</DrawerTitle>
            <DrawerDescription>
              Les préférences enregistrées guident le prochain calcul. Aucun ordre n’est transmis.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-6 px-5 py-5">
            {!profile ? (
              <p className="text-sm text-muted-foreground">Profil momentanément indisponible.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    field="monthlyContributionTarget"
                    label="Versement mensuel cible"
                    htmlFor="advisor-profile-contribution"
                    error={errors.monthlyContributionTarget}
                  >
                    <Input
                      id="advisor-profile-contribution"
                      type="number"
                      min={0}
                      max={1_000_000}
                      step="0.01"
                      inputMode="decimal"
                      value={draft.monthlyContributionTarget ?? ''}
                      onChange={event => update('monthlyContributionTarget', event.target.value)}
                      disabled={!isAdmin || isPending}
                      aria-invalid={errors.monthlyContributionTarget ? true : undefined}
                      aria-describedby={
                        errors.monthlyContributionTarget
                          ? fieldErrorId('monthlyContributionTarget')
                          : 'advisor-profile-contribution-hint'
                      }
                    />
                    <p
                      id="advisor-profile-contribution-hint"
                      className="text-[11px] leading-relaxed text-muted-foreground"
                    >
                      Laisser vide signifie qu’aucune cible mensuelle n’est définie.
                    </p>
                  </Field>

                  <Field
                    field="horizonYears"
                    label="Horizon"
                    htmlFor="advisor-profile-horizon"
                    error={errors.horizonYears}
                  >
                    <div className="relative">
                      <Input
                        id="advisor-profile-horizon"
                        type="number"
                        min={1}
                        max={80}
                        step={1}
                        inputMode="numeric"
                        value={draft.horizonYears ?? ''}
                        onChange={event => update('horizonYears', event.target.value)}
                        disabled={!isAdmin || isPending}
                        aria-invalid={errors.horizonYears ? true : undefined}
                        aria-describedby={
                          errors.horizonYears ? fieldErrorId('horizonYears') : undefined
                        }
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                        ans
                      </span>
                    </div>
                  </Field>

                  <Field
                    field="riskProfile"
                    label="Profil de risque"
                    htmlFor="advisor-profile-risk"
                    error={errors.riskProfile}
                  >
                    <Select
                      value={draft.riskProfile ?? ''}
                      onValueChange={value => update('riskProfile', value)}
                      disabled={!isAdmin || isPending}
                    >
                      <SelectTrigger
                        id="advisor-profile-risk"
                        className="h-10 w-full"
                        aria-invalid={errors.riskProfile ? true : undefined}
                        aria-describedby={
                          errors.riskProfile ? fieldErrorId('riskProfile') : undefined
                        }
                      >
                        <SelectValue placeholder="Choisir un profil" />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_PROFILE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    field="rebalanceThresholdPct"
                    label="Seuil de rééquilibrage"
                    htmlFor="advisor-profile-rebalance"
                    error={errors.rebalanceThresholdPct}
                  >
                    <div className="relative">
                      <Input
                        id="advisor-profile-rebalance"
                        type="number"
                        min={1}
                        max={50}
                        step="0.1"
                        inputMode="decimal"
                        value={draft.rebalanceThresholdPct ?? ''}
                        onChange={event => update('rebalanceThresholdPct', event.target.value)}
                        disabled={!isAdmin || isPending}
                        aria-invalid={errors.rebalanceThresholdPct ? true : undefined}
                        aria-describedby={
                          errors.rebalanceThresholdPct
                            ? fieldErrorId('rebalanceThresholdPct')
                            : undefined
                        }
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </Field>
                </div>

                <Field
                  field="description"
                  label="Intention du profil"
                  htmlFor="advisor-profile-description"
                  error={errors.description}
                >
                  <textarea
                    id="advisor-profile-description"
                    rows={3}
                    maxLength={2000}
                    value={draft.description ?? ''}
                    onChange={event => update('description', event.target.value)}
                    disabled={!isAdmin || isPending}
                    aria-invalid={errors.description ? true : undefined}
                    aria-describedby={errors.description ? fieldErrorId('description') : undefined}
                    className="w-full resize-y rounded-control border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/70 disabled:opacity-50"
                  />
                </Field>

                <section
                  className="space-y-3 border-t border-border/60 pt-5"
                  aria-labelledby="advisor-profile-target-title"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="advisor-profile-target-title" className="text-sm font-medium">
                      Répartition cible
                    </h3>
                    <Status
                      tone={target.targetIsValid ? 'positive' : 'attention'}
                      label={target.targetIsValid ? 'Cible complète' : 'Cible à vérifier'}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {target.rows.map(row => (
                      <div key={row.bucket} className="border-l border-border/70 pl-3">
                        <p className="font-financial text-base tabular-nums">
                          {row.targetPct === null ? 'Indisponible' : `${row.targetPct} %`}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {INVESTMENT_BUCKET_LABEL[row.bucket]}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Ces pourcentages sont en lecture seule. Le profil de risque ne les modifie pas
                    automatiquement.
                  </p>
                </section>
              </>
            )}

            {!isAdmin && profile ? (
              <Status tone="neutral" label="Mode démo en lecture seule" />
            ) : null}
            {mutationError ? (
              <p role="alert" className="text-sm text-negative">
                L’enregistrement n’a pas abouti. Le profil actuel est conservé.
              </p>
            ) : null}
          </div>

          <DrawerFooter className="sticky bottom-0 border-t border-border/60 bg-card pt-4">
            {isAdmin ? (
              <Button type="submit" size="lg" disabled={!profile || isPending}>
                {isPending ? 'Enregistrement…' : 'Enregistrer le profil'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {isAdmin ? 'Annuler' : 'Fermer'}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}

function Field({
  field,
  label,
  htmlFor,
  error,
  children,
}: {
  field: keyof InvestmentProfileFormDraft
  label: string
  htmlFor: string
  error: string | undefined
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p id={fieldErrorId(field)} className="text-[11px] text-negative">
          {error}
        </p>
      ) : null}
    </div>
  )
}
