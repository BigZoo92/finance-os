/**
 * SourceFilters — canonical filter surface for the source gallery.
 *
 * Options come only from the sources present (platform, group, topics,
 * status). Desktop: detached Popover. Mobile: bottom Drawer. Choices are a
 * draft until "Appliquer", exactly like the canonical frame.
 */
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
} from '@finance-os/ui/components'
import { FilterPixelIcon } from '@finance-os/ui/icons/pixel'
import { cn } from '@finance-os/ui/lib/utils'
import { type ReactNode, useState } from 'react'
import {
  countActiveFilters,
  GROUP_LABEL,
  PLATFORM_LABEL,
  type SocialFacets,
  type SocialFilters,
  STATUS_PRESENTATION,
} from '@/features/social/view-model'

type FilterDraft = Omit<SocialFilters, 'q'>

type SourceFiltersProps = {
  filters: SocialFilters
  facets: SocialFacets
  matchCount: number
  isMobile: boolean
  onApply: (next: FilterDraft) => void
}

const toDraft = (filters: SocialFilters): FilterDraft => ({
  platform: filters.platform,
  tag: filters.tag,
  status: filters.status,
  group: filters.group,
})

const EMPTY_DRAFT: FilterDraft = { platform: null, tag: null, status: null, group: null }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">
        {title}
      </legend>
      <div className="mt-2.5">{children}</div>
    </fieldset>
  )
}

export function SourceFilters({
  filters,
  facets,
  matchCount,
  isMobile,
  onApply,
}: SourceFiltersProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(filters))
  const activeCount = countActiveFilters(filters)

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(toDraft(filters))
    setOpen(next)
  }

  const apply = (next: FilterDraft) => {
    onApply(next)
    setOpen(false)
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'min-h-9 gap-2',
        activeCount > 0 && 'border-primary/40 bg-primary/10 text-primary'
      )}
      aria-expanded={open}
    >
      <FilterPixelIcon size={13} aria-hidden="true" />
      Filtres
      {activeCount > 0 ? (
        <span className="font-mono text-[10px]">
          {activeCount}
          <span className="sr-only"> {activeCount > 1 ? 'filtres actifs' : 'filtre actif'}</span>
        </span>
      ) : null}
    </Button>
  )

  const body = (
    <div className="flex flex-col gap-5">
      {facets.platforms.length > 1 ? (
        <Section title="Source">
          <SegmentedControl
            size="sm"
            aria-label="Source"
            value={draft.platform ?? 'all'}
            onChange={value =>
              setDraft(current => ({
                ...current,
                platform: value === 'all' ? null : (value as NonNullable<FilterDraft['platform']>),
              }))
            }
            options={[
              { value: 'all', label: 'Tout' },
              ...facets.platforms.map(platform => ({
                value: platform,
                label: PLATFORM_LABEL[platform],
              })),
            ]}
          />
        </Section>
      ) : null}

      {facets.groups.length > 1 ? (
        <Section title="Groupe">
          <SegmentedControl
            size="sm"
            aria-label="Groupe"
            value={draft.group ?? 'all'}
            onChange={value =>
              setDraft(current => ({
                ...current,
                group: value === 'all' ? null : (value as NonNullable<FilterDraft['group']>),
              }))
            }
            options={[
              { value: 'all', label: 'Tout' },
              ...facets.groups.map(group => ({ value: group, label: GROUP_LABEL[group] })),
            ]}
          />
        </Section>
      ) : null}

      {facets.tags.length > 0 ? (
        <Section title="Sujet">
          <div className="flex flex-wrap gap-1.5">
            {facets.tags.map(tag => {
              const active = draft.tag !== null && draft.tag.toLowerCase() === tag.toLowerCase()
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft(current => ({ ...current, tag: active ? null : tag }))}
                  className={cn(
                    'min-h-8 rounded-tile border px-2.5 text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/70',
                    active
                      ? 'border-primary/40 bg-primary/12 font-medium text-primary'
                      : 'border-foreground/14 text-foreground/65 hover:text-foreground'
                  )}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </Section>
      ) : null}

      <Section title="Statut">
        <SegmentedControl
          size="sm"
          aria-label="Statut"
          value={draft.status ?? 'all'}
          onChange={value =>
            setDraft(current => ({
              ...current,
              status: value === 'all' ? null : (value as NonNullable<FilterDraft['status']>),
            }))
          }
          options={[
            { value: 'all', label: 'Tout' },
            { value: 'active', label: STATUS_PRESENTATION.active.label },
            { value: 'paused', label: STATUS_PRESENTATION.paused.label },
          ]}
        />
      </Section>

      <div className="flex items-center justify-between gap-3 border-t border-foreground/9 pt-3.5">
        <button
          type="button"
          onClick={() => apply(EMPTY_DRAFT)}
          className="min-h-9 text-xs text-foreground/45 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
        >
          Réinitialiser
        </button>
        <Button
          type="button"
          size="sm"
          variant="soft"
          className="min-h-9"
          onClick={() => apply(draft)}
        >
          Appliquer
        </Button>
      </div>
      <p className="font-mono text-[11px] text-foreground/45">
        {matchCount} {matchCount === 1 ? 'source correspondante' : 'sources correspondantes'}
      </p>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent side="bottom">
          <div className="px-5 pb-3 pt-5">
            <DrawerTitle className="text-[15px]">Filtres</DrawerTitle>
            <DrawerDescription className="sr-only">Filtrer les sources suivies</DrawerDescription>
            <div className="mt-4">{body}</div>
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-5">
        {body}
      </PopoverContent>
    </Popover>
  )
}
