/**
 * SourceFilters — canonical filter surface for the source gallery.
 *
 * Options come only from the sources present (platform, group, topics,
 * status). Desktop: detached Popover. Mobile: bottom Drawer. Choices are a
 * draft until "Appliquer", exactly like the canonical frame.
 */
import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
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

const sectionLegend = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'foreground/45',
})

// Active filters tint the outline trigger, merged through the `css` prop. The tint
// also holds on hover, as the former Tailwind classes did over the recipe's `_hover`.
const activeTrigger = css.raw({
  borderColor: 'primary/40',
  bg: 'primary/10',
  color: 'primary',
  _hover: { borderColor: 'primary/40', bg: 'primary/10', color: 'primary' },
})

const tagToggle = cva({
  base: {
    minH: '8',
    rounded: 'tile',
    borderWidth: '1px',
    px: '2.5',
    textStyle: 'xs',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  },
  variants: {
    active: {
      true: { borderColor: 'primary/40', bg: 'primary/12', fontWeight: 'medium', color: 'primary' },
      false: {
        borderColor: 'foreground/14',
        color: 'foreground/65',
        _hover: { color: 'foreground' },
      },
    },
  },
})

const filtersFooter = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  borderTopWidth: '1px',
  borderColor: 'foreground/9',
  pt: '3.5',
})

const resetButton = css({
  minH: '9',
  textStyle: 'xs',
  color: 'foreground/45',
  outlineStyle: 'none',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { color: 'foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const matchCountText = css({ fontFamily: 'mono', fontSize: '11px', color: 'foreground/45' })

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <styled.fieldset minW="0">
      <legend className={sectionLegend}>{title}</legend>
      <styled.div mt="2.5">{children}</styled.div>
    </styled.fieldset>
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
      minH="9"
      gap="2"
      {...(activeCount > 0 ? { css: activeTrigger } : {})}
      aria-expanded={open}
    >
      <FilterPixelIcon size={13} aria-hidden="true" />
      Filtres
      {activeCount > 0 ? (
        <styled.span fontFamily="mono" fontSize="10px">
          {activeCount}
          <styled.span srOnly> {activeCount > 1 ? 'filtres actifs' : 'filtre actif'}</styled.span>
        </styled.span>
      ) : null}
    </Button>
  )

  const body = (
    <styled.div display="flex" flexDirection="column" gap="5">
      {facets.platforms.length > 1 ? (
        <Section title="Source">
          <SegmentedControl
            size="sm"
            aria-label="Source"
            value={draft.platform ?? 'all'}
            onChange={value =>
              setDraft(current => ({
                ...current,
                platform: value === 'all' ? null : value,
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
                group: value === 'all' ? null : value,
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
          <styled.div display="flex" flexWrap="wrap" gap="1.5">
            {facets.tags.map(tag => {
              const active = draft.tag !== null && draft.tag.toLowerCase() === tag.toLowerCase()
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft(current => ({ ...current, tag: active ? null : tag }))}
                  className={tagToggle({ active })}
                >
                  {tag}
                </button>
              )
            })}
          </styled.div>
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
              status: value === 'all' ? null : value,
            }))
          }
          options={[
            { value: 'all', label: 'Tout' },
            { value: 'active', label: STATUS_PRESENTATION.active.label },
            { value: 'paused', label: STATUS_PRESENTATION.paused.label },
          ]}
        />
      </Section>

      <div className={filtersFooter}>
        <button type="button" onClick={() => apply(EMPTY_DRAFT)} className={resetButton}>
          Réinitialiser
        </button>
        <Button type="button" size="sm" variant="soft" minH="9" onClick={() => apply(draft)}>
          Appliquer
        </Button>
      </div>
      <p className={matchCountText}>
        {matchCount} {matchCount === 1 ? 'source correspondante' : 'sources correspondantes'}
      </p>
    </styled.div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent side="bottom">
          <styled.div px="5" pb="3" pt="5">
            <DrawerTitle fontSize="15px" lineHeight="inherit">
              Filtres
            </DrawerTitle>
            <DrawerDescription srOnly>Filtrer les sources suivies</DrawerDescription>
            <styled.div mt="4">{body}</styled.div>
          </styled.div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" w="320px" p="5">
        {body}
      </PopoverContent>
    </Popover>
  )
}
