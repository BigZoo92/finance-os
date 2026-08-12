import {
  Button,
  CurrencyAmount,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Freshness,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
  ValuationState,
} from '@finance-os/ui/components'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  deleteDashboardManualAsset,
  patchDashboardManualAsset,
  postDashboardManualAsset,
} from '@/features/dashboard-api'
import {
  dashboardManualAssetsQueryOptionsWithMode,
  dashboardQueryKeys,
} from '@/features/dashboard-query-options'
import type { DashboardManualAssetResponse, DashboardRange } from '@/features/dashboard-types'

type ManualAssetDraft = {
  assetType: 'cash' | 'investment' | 'manual'
  name: string
  currency: string
  valuation: string
  valuationAsOf: string
  category: string
  note: string
  enabled: boolean
}

const EMPTY_DRAFT: ManualAssetDraft = {
  assetType: 'manual',
  name: '',
  currency: 'EUR',
  valuation: '',
  valuationAsOf: '',
  category: '',
  note: '',
  enabled: true,
}

const assetTypeLabel = (type: ManualAssetDraft['assetType']) => {
  if (type === 'cash') return 'Liquidités'
  if (type === 'investment') return 'Investissement'
  return 'Manuel'
}

const toDatetimeLocalValue = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const toDraft = (asset: DashboardManualAssetResponse): ManualAssetDraft => ({
  assetType: asset.type,
  name: asset.name,
  currency: asset.currency,
  valuation: String(asset.valuation),
  valuationAsOf: toDatetimeLocalValue(asset.valuationAsOf),
  category: asset.category ?? '',
  note: asset.note ?? '',
  enabled: asset.enabled,
})

const optionalText = (value: string) => value.trim() || null

const validateDraft = (draft: ManualAssetDraft) => {
  const valuation = Number(draft.valuation)
  if (!draft.name.trim()) return 'Le nom est requis'
  if (!draft.currency.trim()) return 'La devise est requise'
  if (!draft.valuation.trim() || !Number.isFinite(valuation) || valuation < 0) {
    return 'La valorisation doit être un nombre positif ou nul'
  }
  if (draft.valuationAsOf && Number.isNaN(new Date(draft.valuationAsOf).getTime())) {
    return 'La date de valorisation est invalide'
  }
  return null
}

export function ManualAssetsEditor({ range }: { range: DashboardRange }) {
  const queryClient = useQueryClient()
  const assetsQuery = useQuery(dashboardManualAssetsQueryOptionsWithMode({ mode: 'admin' }))
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ManualAssetDraft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const validationError = validateDraft(draft)

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.manualAssets() }),
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.summary(range) }),
    ])
  }
  const closeEditor = () => {
    setOpen(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }
  const saveMutation = useMutation({
    mutationFn: async () => {
      const valuation = Number(draft.valuation)
      if (validationError || !Number.isFinite(valuation))
        throw new Error(validationError ?? 'Valeur invalide')
      const payload = {
        assetType: draft.assetType,
        name: draft.name.trim(),
        currency: draft.currency.trim().toUpperCase(),
        valuation,
        valuationAsOf: draft.valuationAsOf ? new Date(draft.valuationAsOf).toISOString() : null,
        note: optionalText(draft.note),
        category: optionalText(draft.category),
        enabled: draft.enabled,
      }
      return editingId === null
        ? postDashboardManualAsset(payload)
        : patchDashboardManualAsset({ assetId: editingId, ...payload })
    },
    onSuccess: async () => {
      closeEditor()
      await invalidate()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteDashboardManualAsset,
    onSuccess: async () => {
      setDeleteConfirmId(null)
      await invalidate()
    },
  })
  const assets = assetsQuery.data?.items ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Actifs manuels</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Valorisations saisies par vous, identifiées comme manuelles.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingId(null)
            setDraft(EMPTY_DRAFT)
            setOpen(true)
          }}
        >
          Ajouter un actif
        </Button>
      </div>

      {assetsQuery.isPending ? <Status tone="progress" label="Chargement" /> : null}
      {assetsQuery.isError ? (
        <Status tone="attention" label="Actifs manuels indisponibles" />
      ) : null}
      {!assetsQuery.isPending && assets.length === 0 ? (
        <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">
          Aucun actif manuel
        </div>
      ) : (
        <div className="divide-y divide-border border-y border-border">
          {assets.map(asset => (
            <article
              key={asset.assetId}
              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-medium">{asset.name}</p>
                  <ValuationState state="manual" />
                  {!asset.enabled ? <Status tone="neutral" label="Masqué" /> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{assetTypeLabel(asset.type)}</span>
                  {asset.category ? <span>{asset.category}</span> : null}
                  <Freshness asOf={asset.valuationAsOf} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <CurrencyAmount
                  value={asset.valuation}
                  currency={asset.currency}
                  className="mr-2 text-sm font-semibold"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(asset.assetId)
                    setDraft(toDraft(asset))
                    setOpen(true)
                  }}
                >
                  Modifier
                </Button>
                {deleteConfirmId === asset.assetId ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirmId(null)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(asset.assetId)}
                    >
                      Confirmer
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteConfirmId(asset.assetId)}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next && !saveMutation.isPending) closeEditor()
        }}
      >
        <DialogContent className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
          <DialogHeader>
            <DialogTitle>
              {editingId === null ? 'Ajouter un actif manuel' : 'Modifier l’actif manuel'}
            </DialogTitle>
            <DialogDescription>
              La valeur reste signalée comme manuelle dans toutes les vues.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm" htmlFor="manual-asset-type">
              <span>Type</span>
              <Select
                value={draft.assetType}
                onValueChange={value =>
                  setDraft(current => ({
                    ...current,
                    assetType: value as ManualAssetDraft['assetType'],
                  }))
                }
              >
                <SelectTrigger id="manual-asset-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manuel</SelectItem>
                  <SelectItem value="cash">Liquidités</SelectItem>
                  <SelectItem value="investment">Investissement</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-2 text-sm" htmlFor="manual-asset-currency">
              <span>Devise</span>
              <Input
                id="manual-asset-currency"
                value={draft.currency}
                maxLength={8}
                onChange={event =>
                  setDraft(current => ({ ...current, currency: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2 text-sm sm:col-span-2" htmlFor="manual-asset-name">
              <span>Nom</span>
              <Input
                id="manual-asset-name"
                value={draft.name}
                maxLength={120}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm" htmlFor="manual-asset-valuation">
              <span>Valorisation</span>
              <Input
                id="manual-asset-valuation"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.valuation}
                onChange={event =>
                  setDraft(current => ({ ...current, valuation: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2 text-sm" htmlFor="manual-asset-date">
              <span>Valorisation au</span>
              <Input
                id="manual-asset-date"
                type="datetime-local"
                value={draft.valuationAsOf}
                onChange={event =>
                  setDraft(current => ({ ...current, valuationAsOf: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2 text-sm sm:col-span-2" htmlFor="manual-asset-category">
              <span>Catégorie</span>
              <Input
                id="manual-asset-category"
                value={draft.category}
                maxLength={64}
                onChange={event =>
                  setDraft(current => ({ ...current, category: event.target.value }))
                }
              />
            </label>
            <label className="space-y-2 text-sm sm:col-span-2" htmlFor="manual-asset-note">
              <span>Note</span>
              <textarea
                id="manual-asset-note"
                value={draft.note}
                maxLength={280}
                rows={3}
                onChange={event => setDraft(current => ({ ...current, note: event.target.value }))}
                className="min-h-24 w-full rounded-control border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={event =>
                  setDraft(current => ({ ...current, enabled: event.target.checked }))
                }
              />
              <span>Afficher cet actif dans le patrimoine</span>
            </label>
          </div>
          {validationError ? (
            <p className="text-sm text-muted-foreground">{validationError}</p>
          ) : null}
          {saveMutation.isError ? (
            <Status tone="negative" label="Enregistrement impossible" />
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={saveMutation.isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={Boolean(validationError) || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Enregistrement' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
