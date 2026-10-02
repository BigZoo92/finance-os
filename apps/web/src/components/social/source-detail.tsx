/**
 * SourceDetail — compact contextual surface for the selected source.
 *
 * Identity, bio, source, status, group, the last useful freshness signal
 * when it exists, topics, and a Radar link only when the source has really
 * contributed to current events. Admin management stays here, behind a
 * canonical confirmation Dialog for deletion.
 */
import { css } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const detailRow = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '4',
  textStyle: 'xs',
})

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={detailRow}>
      <styled.dt flexShrink="0" color="foreground/45">
        {label}
      </styled.dt>
      <styled.dd minW="0" textAlign="right" color="foreground">
        {children}
      </styled.dd>
    </div>
  )
}

const handleText = css({
  mt: '0.5',
  truncate: true,
  fontFamily: 'mono',
  fontSize: '11px',
  color: 'foreground/45',
})

const escapeHint = css({ fontFamily: 'mono', fontSize: '10px', color: 'foreground/35' })

const detailFacts = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2.5',
  borderTopWidth: '1px',
  borderColor: 'foreground/9',
  pt: '3.5',
})

const topicsLabel = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'foreground/45',
})

const detailActions = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  columnGap: '4',
  rowGap: '2',
  borderTopWidth: '1px',
  borderColor: 'foreground/9',
  pt: '3.5',
})

const profileLink = css({
  mr: 'auto',
  textStyle: 'xs',
  color: 'foreground/60',
  outlineStyle: 'none',
  _hover: { color: 'foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const radarLink = css({
  textStyle: 'xs',
  fontWeight: 'medium',
  color: 'primary',
  outlineStyle: 'none',
  _hover: { textDecorationLine: 'underline' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

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
    <styled.div display="flex" flexDirection="column" gap="3.5">
      <styled.div display="flex" alignItems="flex-start" gap="3.5">
        <SourceAvatar source={source} size="lg" selected />
        <styled.div minW="0" flex="1">
          <styled.p truncate textStyle="md" fontWeight="semibold" color="foreground">
            {source.name}
          </styled.p>
          <p className={handleText}>@{source.handle}</p>
        </styled.div>
        {showEscapeHint ? (
          <span aria-hidden="true" className={escapeHint}>
            ESC
          </span>
        ) : null}
      </styled.div>

      {source.bio ? (
        <styled.p fontSize="13px" lineHeight="relaxed" color="foreground/75">
          {source.bio}
        </styled.p>
      ) : null}

      <dl className={detailFacts}>
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
            <styled.span fontFamily="mono">
              {relatedSignals} {relatedSignals > 1 ? 'événements associés' : 'événement associé'}
            </styled.span>
          </DetailRow>
        ) : null}
      </dl>

      {source.tags.length > 0 ? (
        <styled.div borderTopWidth="1px" borderColor="foreground/9" pt="3.5">
          <p className={topicsLabel}>Sujets</p>
          <styled.div mt="2" display="flex" flexWrap="wrap" gap="1.5">
            {source.tags.map(tag => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </styled.div>
        </styled.div>
      ) : null}

      {relatedSignals > 0 || isAdmin || source.url ? (
        <div className={detailActions}>
          {source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer noopener" className={profileLink}>
              Ouvrir le profil
            </a>
          ) : null}
          {relatedSignals > 0 ? (
            <Link to="/radar" className={radarLink}>
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
                color="negative"
                _hover={{ color: 'negative' }}
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
        <DialogContent maxW="sm">
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
    </styled.div>
  )
}
