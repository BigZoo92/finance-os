/**
 * SourceDetail — compact contextual surface for the selected source.
 *
 * Identity, bio, source, status, group, the last useful freshness signal
 * when it exists, topics, and a Radar link only when the source has really
 * contributed to current events. Admin management stays here, behind a
 * canonical confirmation Dialog for deletion.
 */
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Freshness,
  Status,
} from '@finance-os/ui/components'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  GROUP_LABEL,
  PLATFORM_LABEL,
  type SourceCardModel,
  STATUS_PRESENTATION,
} from '@/features/social/view-model'
import { SourceAvatar, TagChip } from './source-card'

type SourceDetailProps = {
  source: SourceCardModel
  relatedSignals: number
  isAdmin: boolean
  togglePending: boolean
  deletePending: boolean
  showEscapeHint: boolean
  onToggle: () => void
  onDelete: () => void
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <dt className="shrink-0 text-foreground/45">{label}</dt>
      <dd className="min-w-0 text-right text-foreground">{children}</dd>
    </div>
  )
}

export function SourceDetail({
  source,
  relatedSignals,
  isAdmin,
  togglePending,
  deletePending,
  showEscapeHint,
  onToggle,
  onDelete,
}: SourceDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const status = STATUS_PRESENTATION[source.status]

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start gap-3.5">
        <SourceAvatar source={source} size="lg" selected />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{source.name}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-foreground/45">
            @{source.handle}
          </p>
        </div>
        {showEscapeHint ? (
          <span aria-hidden="true" className="font-mono text-[10px] text-foreground/35">
            ESC
          </span>
        ) : null}
      </div>

      {source.bio ? (
        <p className="text-[13px] leading-relaxed text-foreground/75">{source.bio}</p>
      ) : null}

      <dl className="flex flex-col gap-2.5 border-t border-foreground/9 pt-3.5">
        <DetailRow label="Source">{PLATFORM_LABEL[source.platform]}</DetailRow>
        <DetailRow label="Statut">
          <Status tone={status.tone} label={status.label} />
        </DetailRow>
        <DetailRow label="Groupe">{GROUP_LABEL[source.group]}</DetailRow>
        {source.lastFetchedAt ? (
          <DetailRow label="Dernière collecte">
            <Freshness asOf={source.lastFetchedAt} staleAfterMinutes={7 * 24 * 60} />
          </DetailRow>
        ) : null}
        {relatedSignals > 0 ? (
          <DetailRow label="Récent">
            <span className="font-mono">
              {relatedSignals} {relatedSignals > 1 ? 'événements associés' : 'événement associé'}
            </span>
          </DetailRow>
        ) : null}
      </dl>

      {source.tags.length > 0 ? (
        <div className="border-t border-foreground/9 pt-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">
            Sujets
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {source.tags.map(tag => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
        </div>
      ) : null}

      {relatedSignals > 0 || isAdmin || source.url ? (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-foreground/9 pt-3.5">
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="mr-auto text-xs text-foreground/60 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              Ouvrir le profil
            </a>
          ) : null}
          {relatedSignals > 0 ? (
            <Link
              to="/radar"
              className="text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/70"
            >
              Voir dans Radar
            </Link>
          ) : null}
          {isAdmin ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={togglePending || deletePending}
                onClick={onToggle}
              >
                {source.enabled ? 'Mettre en pause' : 'Activer'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-negative hover:text-negative"
                disabled={togglePending || deletePending}
                onClick={() => setConfirmOpen(true)}
              >
                Supprimer
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette source</DialogTitle>
            <DialogDescription>
              {source.name} (@{source.handle}) ne sera plus suivie. Les événements déjà collectés
              restent en place.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={deletePending}>
                Annuler
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePending}
              onClick={() => {
                setConfirmOpen(false)
                onDelete()
              }}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
