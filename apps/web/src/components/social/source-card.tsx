/**
 * SourceCard — canonical Social Intelligence source entity.
 *
 * Identity first: avatar, name, handle, short bio, then tags, platform and a
 * light human status. Two compositions share one model: the gallery card
 * (tablet and up) and the compact row (mobile). Cards are toggle buttons
 * that open the contextual detail.
 */
import { Avatar, AvatarFallback, AvatarImage, Status } from '@finance-os/ui/components'
import { cn } from '@finance-os/ui/lib/utils'
import {
  type AvatarTint,
  PLATFORM_GLYPH,
  PLATFORM_LABEL,
  type SocialPlatform,
  type SourceCardModel,
  STATUS_PRESENTATION,
} from '@/features/social/view-model'

const TINT_CLASS: Record<AvatarTint, string> = {
  primary:
    'bg-[linear-gradient(135deg,oklch(from_var(--primary)_l_c_h/26%),oklch(from_var(--primary)_l_c_h/8%))]',
  teal: 'bg-[linear-gradient(135deg,oklch(from_var(--teal)_l_c_h/26%),oklch(from_var(--teal)_l_c_h/7%))]',
  warm: 'bg-[linear-gradient(135deg,oklch(from_var(--warm-accent)_l_c_h/28%),oklch(from_var(--warm-accent)_l_c_h/8%))]',
  neutral:
    'bg-[linear-gradient(135deg,oklch(from_var(--foreground)_l_c_h/16%),oklch(from_var(--foreground)_l_c_h/5%))]',
}

const AVATAR_SIZE = {
  sm: { box: 'size-[38px]', radius: 'rounded-control', text: 'text-[11px]' },
  md: { box: 'size-11', radius: 'rounded-[9px]', text: 'text-[13px]' },
  lg: { box: 'size-[52px]', radius: 'rounded-dropdown', text: 'text-[15px]' },
} as const

export function SourceAvatar({
  source,
  size = 'md',
  selected = false,
  className,
}: {
  source: Pick<SourceCardModel, 'avatarUrl' | 'initials' | 'avatarTint' | 'name'>
  size?: keyof typeof AVATAR_SIZE
  /** Selected state accent: two Command Pixel corner marks. */
  selected?: boolean
  className?: string
}) {
  const dimensions = AVATAR_SIZE[size]
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar
        className={cn(
          'border border-foreground/16',
          dimensions.box,
          dimensions.radius,
          dimensions.text,
          TINT_CLASS[source.avatarTint],
          selected && 'border-primary/40'
        )}
      >
        {source.avatarUrl ? (
          <AvatarImage
            src={source.avatarUrl}
            alt=""
            className={cn('object-cover', dimensions.radius)}
          />
        ) : null}
        <AvatarFallback
          className={cn('bg-transparent font-mono text-foreground', dimensions.radius)}
          delayMs={source.avatarUrl ? 400 : 0}
        >
          {source.initials}
        </AvatarFallback>
      </Avatar>
      {selected ? (
        <>
          <span aria-hidden="true" className="absolute -left-[3px] -top-[3px] size-1 bg-primary" />
          <span
            aria-hidden="true"
            className="absolute -bottom-[3px] -right-[3px] size-1 bg-primary"
          />
        </>
      ) : null}
    </span>
  )
}

export function PlatformTile({
  platform,
  className,
}: {
  platform: SocialPlatform
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label={PLATFORM_LABEL[platform]}
      className={cn(
        'grid h-5 min-w-5 shrink-0 place-items-center rounded-[5px] border border-foreground/16 px-1 font-mono text-[9px] text-foreground/65',
        className
      )}
    >
      {PLATFORM_GLYPH[platform]}
    </span>
  )
}

export function TagChip({ children, compact = false }: { children: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[5px] border border-foreground/14 text-foreground/70',
        compact ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'
      )}
    >
      {children}
    </span>
  )
}

type SourceCardProps = {
  source: SourceCardModel
  selected: boolean
  variant: 'card' | 'row'
  onSelect: (id: number, trigger: HTMLElement) => void
}

export function SourceCard({ source, selected, variant, onSelect }: SourceCardProps) {
  const status = STATUS_PRESENTATION[source.status]

  if (variant === 'row') {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={event => onSelect(source.id, event.currentTarget)}
        className={cn(
          'flex min-h-[64px] w-full items-center gap-3 border-b border-foreground/9 py-3 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70',
          selected && 'bg-primary/6'
        )}
      >
        <SourceAvatar source={source} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{source.name}</span>
          <span className="mt-0.5 block truncate font-mono text-[10px] text-foreground/45">
            @{source.handle}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {source.tags[0] ? <TagChip compact>{source.tags[0]}</TagChip> : null}
          <Status tone={status.tone} label={<span className="sr-only">{status.label}</span>} />
        </span>
      </button>
    )
  }

  const visibleTags = source.tags.slice(0, 3)
  const hiddenTags = source.tags.length - visibleTags.length

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={event => onSelect(source.id, event.currentTarget)}
      className={cn(
        'flex h-full w-full flex-col rounded-surface border bg-card p-5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/70',
        selected ? 'border-primary/40' : 'border-foreground/10 hover:border-foreground/22'
      )}
    >
      <span className="flex items-start gap-3.5">
        <SourceAvatar source={source} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-foreground">
            {source.name}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-foreground/45">
            @{source.handle}
          </span>
        </span>
        <Status
          tone={status.tone}
          label={status.label}
          className="shrink-0 font-mono text-[10px] leading-[inherit]"
        />
      </span>
      {source.bio ? (
        <span className="mt-3.5 line-clamp-2 text-[13px] leading-relaxed text-foreground/65">
          {source.bio}
        </span>
      ) : null}
      <span className="mt-auto flex items-center gap-1.5 pt-4">
        {visibleTags.map(tag => (
          <TagChip key={tag}>{tag}</TagChip>
        ))}
        {hiddenTags > 0 ? (
          <span className="font-mono text-[10px] text-foreground/45">+{hiddenTags}</span>
        ) : null}
        <PlatformTile platform={source.platform} className="ml-auto" />
      </span>
    </button>
  )
}
