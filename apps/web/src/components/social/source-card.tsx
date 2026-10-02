/**
 * SourceCard — canonical Social Intelligence source entity.
 *
 * Identity first: avatar, name, handle, short bio, then tags, platform and a
 * light human status. Two compositions share one model: the gallery card
 * (tablet and up) and the compact row (mobile). Cards are toggle buttons
 * that open the contextual detail.
 */
import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import type { JsxStyleProps } from '@finance-os/styled-system/types'
import { Avatar, AvatarFallback, AvatarImage, Status } from '@finance-os/ui/components'
import { withStyleProps } from '@finance-os/ui/lib/style-props'
import {
  PLATFORM_GLYPH,
  PLATFORM_LABEL,
  type SocialPlatform,
  type SourceCardModel,
  STATUS_PRESENTATION,
} from '@/features/social/view-model'

type AvatarSize = 'sm' | 'md' | 'lg'

/*
 * Avatar frame, passed to the shared Avatar through its `css` prop so size, radius,
 * border and tint replace the recipe's own values per property. The root text sizes
 * are the former classes; the initials keep the fallback's own `sm` text style.
 */
const avatarFrame = cva({
  base: { borderWidth: '1px', borderColor: 'foreground/16' },
  variants: {
    size: {
      sm: { boxSize: '38px', rounded: 'control', fontSize: '11px' },
      md: { boxSize: '11', rounded: '9px', fontSize: '13px' },
      lg: { boxSize: '52px', rounded: 'dropdown', fontSize: '15px' },
    },
    tint: {
      primary: {
        bgImage:
          'linear-gradient(135deg, oklch(from {colors.primary} l c h / 26%), oklch(from {colors.primary} l c h / 8%))',
      },
      teal: {
        bgImage:
          'linear-gradient(135deg, oklch(from {colors.teal} l c h / 26%), oklch(from {colors.teal} l c h / 7%))',
      },
      warm: {
        bgImage:
          'linear-gradient(135deg, oklch(from {colors.warmAccent} l c h / 28%), oklch(from {colors.warmAccent} l c h / 8%))',
      },
      neutral: {
        bgImage:
          'linear-gradient(135deg, oklch(from {colors.foreground} l c h / 16%), oklch(from {colors.foreground} l c h / 5%))',
      },
    },
    selected: {
      true: { borderColor: 'primary/40' },
      false: {},
    },
  },
})

const avatarRadius = cva({
  variants: {
    size: {
      sm: { rounded: 'control' },
      md: { rounded: '9px' },
      lg: { rounded: 'dropdown' },
    },
  },
})

const avatarWrap = css({ position: 'relative', display: 'inline-flex', flexShrink: '0' })

const cornerMark = cva({
  base: { position: 'absolute', boxSize: '1', bg: 'primary' },
  variants: {
    corner: {
      topLeft: { left: '-3px', top: '-3px' },
      bottomRight: { bottom: '-3px', right: '-3px' },
    },
  },
})

export function SourceAvatar({
  source,
  size = 'md',
  selected = false,
  className,
}: {
  source: Pick<SourceCardModel, 'avatarUrl' | 'initials' | 'avatarTint' | 'name'>
  size?: AvatarSize
  /** Selected state accent: two Command Pixel corner marks. */
  selected?: boolean
  className?: string
}) {
  const radius = avatarRadius.raw({ size })
  return (
    <span className={cx(avatarWrap, className)}>
      <Avatar css={avatarFrame.raw({ size, tint: source.avatarTint, selected })}>
        {source.avatarUrl ? (
          <AvatarImage src={source.avatarUrl} alt="" objectFit="cover" css={radius} />
        ) : null}
        <AvatarFallback
          bg="transparent"
          fontFamily="mono"
          color="foreground"
          css={radius}
          delayMs={source.avatarUrl ? 400 : 0}
        >
          {source.initials}
        </AvatarFallback>
      </Avatar>
      {selected ? (
        <>
          <span aria-hidden="true" className={cornerMark({ corner: 'topLeft' })} />
          <span aria-hidden="true" className={cornerMark({ corner: 'bottomRight' })} />
        </>
      ) : null}
    </span>
  )
}

const platformTile = css.raw({
  display: 'grid',
  h: '5',
  minW: '5',
  flexShrink: '0',
  placeItems: 'center',
  rounded: '5px',
  borderWidth: '1px',
  borderColor: 'foreground/16',
  px: '1',
  fontFamily: 'mono',
  fontSize: '9px',
  color: 'foreground/65',
})

/** Style props (`ml="auto"`) merge into the tile's own styles. */
export function PlatformTile({
  platform,
  className,
  ...styleProps
}: {
  platform: SocialPlatform
  className?: string
} & JsxStyleProps) {
  const { className: styles } = withStyleProps(styleProps, platformTile)
  return (
    <span role="img" aria-label={PLATFORM_LABEL[platform]} className={cx(styles, className)}>
      {PLATFORM_GLYPH[platform]}
    </span>
  )
}

const tagChip = cva({
  base: {
    flexShrink: '0',
    rounded: '5px',
    borderWidth: '1px',
    borderColor: 'foreground/14',
    color: 'foreground/70',
  },
  variants: {
    compact: {
      true: { px: '1.5', py: '1px', fontSize: '10px' },
      false: { px: '2', py: '0.5', fontSize: '11px' },
    },
  },
})

export function TagChip({ children, compact = false }: { children: string; compact?: boolean }) {
  return <span className={tagChip({ compact })}>{children}</span>
}

const sourceRow = cva({
  base: {
    display: 'flex',
    minH: '64px',
    w: 'full',
    alignItems: 'center',
    gap: '3',
    borderBottomWidth: '1px',
    borderColor: 'foreground/9',
    py: '3',
    textAlign: 'left',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: {
      boxShadow: 'inset 0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)',
    },
  },
  variants: {
    selected: {
      true: { bg: 'primary/6' },
      false: {},
    },
  },
})

const sourceCard = cva({
  base: {
    display: 'flex',
    h: 'full',
    w: 'full',
    flexDirection: 'column',
    rounded: 'surface',
    borderWidth: '1px',
    bg: 'card',
    p: '5',
    textAlign: 'left',
    outlineStyle: 'none',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  },
  variants: {
    selected: {
      true: { borderColor: 'primary/40' },
      false: { borderColor: 'foreground/10', _hover: { borderColor: 'foreground/22' } },
    },
  },
})

const sourceName = cva({
  base: { display: 'block', truncate: true, color: 'foreground' },
  variants: {
    variant: {
      row: { textStyle: 'sm', fontWeight: 'medium' },
      card: { fontSize: '15px', fontWeight: 'semibold' },
    },
  },
})

const sourceHandle = cva({
  base: {
    mt: '0.5',
    display: 'block',
    truncate: true,
    fontFamily: 'mono',
    color: 'foreground/45',
  },
  variants: {
    variant: {
      row: { fontSize: '10px' },
      card: { fontSize: '11px' },
    },
  },
})

const sourceBio = css({
  mt: '3.5',
  lineClamp: '2',
  fontSize: '13px',
  lineHeight: 'relaxed',
  color: 'foreground/65',
})

const visuallyHidden = css({ srOnly: true })

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
        className={sourceRow({ selected })}
      >
        <SourceAvatar source={source} size="sm" />
        <styled.span minW="0" flex="1">
          <span className={sourceName({ variant: 'row' })}>{source.name}</span>
          <span className={sourceHandle({ variant: 'row' })}>@{source.handle}</span>
        </styled.span>
        <styled.span ml="auto" display="flex" flexShrink="0" alignItems="center" gap="2">
          {source.tags[0] ? <TagChip compact>{source.tags[0]}</TagChip> : null}
          <Status
            tone={status.tone}
            label={<span className={visuallyHidden}>{status.label}</span>}
          />
        </styled.span>
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
      className={sourceCard({ selected })}
    >
      <styled.span display="flex" alignItems="flex-start" gap="3.5">
        <SourceAvatar source={source} size="md" />
        <styled.span minW="0" flex="1">
          <span className={sourceName({ variant: 'card' })}>{source.name}</span>
          <span className={sourceHandle({ variant: 'card' })}>@{source.handle}</span>
        </styled.span>
        <Status
          tone={status.tone}
          label={status.label}
          flexShrink="0"
          fontFamily="mono"
          fontSize="10px"
          lineHeight="inherit"
        />
      </styled.span>
      {source.bio ? <span className={sourceBio}>{source.bio}</span> : null}
      <styled.span mt="auto" display="flex" alignItems="center" gap="1.5" pt="4">
        {visibleTags.map(tag => (
          <TagChip key={tag}>{tag}</TagChip>
        ))}
        {hiddenTags > 0 ? (
          <styled.span fontFamily="mono" fontSize="10px" color="foreground/45">
            +{hiddenTags}
          </styled.span>
        ) : null}
        <PlatformTile platform={source.platform} ml="auto" />
      </styled.span>
    </button>
  )
}
