import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const mutedText = css({ textStyle: 'sm', color: 'muted.foreground' })

// Tailwind's `space-y-6` put the margin on every child but the last; the
// read-only Status chip is inline-flex, so the exact rule is kept.
const drawerBody = css({
  px: '5',
  py: '5',
  '& > :not(:last-child)': { marginBlockEnd: '6' },
})

const fieldHint = css({ fontSize: '11px', lineHeight: 'relaxed', color: 'muted.foreground' })

const inputSuffix = css({
  pointerEvents: 'none',
  position: 'absolute',
  insetY: '0',
  right: '3',
  display: 'flex',
  alignItems: 'center',
  textStyle: 'xs',
  color: 'muted.foreground',
})

const profileTextarea = css({
  w: 'full',
  resize: 'vertical',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'input',
  bg: 'transparent',
  px: '3',
  py: '2',
  textStyle: 'sm',
  color: 'foreground',
  outlineStyle: 'none',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _placeholder: { color: 'muted.foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  _disabled: { opacity: '0.5' },
})

// `font-financial` next to `text-base`: one element cannot hold two text
// styles, so the size and line height are the `md` longhands.
const targetValue = css({
  textStyle: 'financial',
  fontSize: 'md',
  lineHeight: 'md',
  fontVariantNumeric: 'tabular-nums',
})

// `space-y-1.5` on the field: the inline label ignores block margins, so the
// gap comes from the control's bottom margin (every child but the last).
const fieldRoot = css({ '& > :not(:last-child)': { marginBlockEnd: '1.5' } })

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
    // oxlint-disable-next-line react/set-state-in-effect -- re-seed the form from the latest saved profile each time the drawer opens.
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
        <styled.form
          display="flex"
          minH="full"
          flexDirection="column"
          onSubmit={handleSubmit}
          noValidate
        >
          <DrawerHeader borderBottomWidth="1px" borderColor="border/60" pb="5">
            <DrawerTitle>Profil d’investissement</DrawerTitle>
            <DrawerDescription>
              Les préférences enregistrées guident le prochain calcul. Aucun ordre n’est transmis.
            </DrawerDescription>
          </DrawerHeader>

          <div className={drawerBody}>
            {!profile ? (
              <p className={mutedText}>Profil momentanément indisponible.</p>
            ) : (
              <>
                <styled.div
                  display="grid"
                  gap="4"
                  sm={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                >
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
                    <p id="advisor-profile-contribution-hint" className={fieldHint}>
                      Laisser vide signifie qu’aucune cible mensuelle n’est définie.
                    </p>
                  </Field>

                  <Field
                    field="horizonYears"
                    label="Horizon"
                    htmlFor="advisor-profile-horizon"
                    error={errors.horizonYears}
                  >
                    <styled.div position="relative">
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
                      <span className={inputSuffix}>ans</span>
                    </styled.div>
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
                        h="10"
                        w="full"
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
                    <styled.div position="relative">
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
                      <span className={inputSuffix}>%</span>
                    </styled.div>
                  </Field>
                </styled.div>

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
                    className={profileTextarea}
                  />
                </Field>

                <styled.section
                  spaceY="3"
                  borderTopWidth="1px"
                  borderColor="border/60"
                  pt="5"
                  aria-labelledby="advisor-profile-target-title"
                >
                  <styled.div
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    gap="3"
                  >
                    <styled.h3 id="advisor-profile-target-title" textStyle="sm" fontWeight="medium">
                      Répartition cible
                    </styled.h3>
                    <Status
                      tone={target.targetIsValid ? 'positive' : 'attention'}
                      label={target.targetIsValid ? 'Cible complète' : 'Cible à vérifier'}
                    />
                  </styled.div>
                  <styled.div
                    display="grid"
                    gridTemplateColumns="repeat(3, minmax(0, 1fr))"
                    gap="2"
                  >
                    {target.rows.map(row => (
                      <styled.div
                        key={row.bucket}
                        borderLeftWidth="1px"
                        borderColor="border/70"
                        pl="3"
                      >
                        <p className={targetValue}>
                          {row.targetPct === null ? 'Indisponible' : `${row.targetPct} %`}
                        </p>
                        <styled.p mt="1" fontSize="11px" color="muted.foreground">
                          {INVESTMENT_BUCKET_LABEL[row.bucket]}
                        </styled.p>
                      </styled.div>
                    ))}
                  </styled.div>
                  <p className={fieldHint}>
                    Ces pourcentages sont en lecture seule. Le profil de risque ne les modifie pas
                    automatiquement.
                  </p>
                </styled.section>
              </>
            )}

            {!isAdmin && profile ? (
              <Status tone="neutral" label="Mode démo en lecture seule" />
            ) : null}
            {mutationError ? (
              <styled.p role="alert" textStyle="sm" color="negative">
                L’enregistrement n’a pas abouti. Le profil actuel est conservé.
              </styled.p>
            ) : null}
          </div>

          <DrawerFooter
            position="sticky"
            bottom="0"
            borderTopWidth="1px"
            borderColor="border/60"
            bg="card"
            pt="4"
          >
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
        </styled.form>
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
    <div className={fieldRoot}>
      <styled.label htmlFor={htmlFor} textStyle="xs" fontWeight="medium" color="foreground">
        {label}
      </styled.label>
      {children}
      {error ? (
        <styled.p id={fieldErrorId(field)} fontSize="11px" color="negative">
          {error}
        </styled.p>
      ) : null}
    </div>
  )
}
