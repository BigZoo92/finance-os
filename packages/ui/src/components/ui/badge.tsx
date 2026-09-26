import { cva, type RecipeVariantProps } from '@finance-os/styled-system/css'
import { type HTMLStyledProps, styled } from '@finance-os/styled-system/jsx'
import { Slot } from 'radix-ui'

const badgeRecipe = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1',
    w: 'fit',
    flexShrink: '0',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    rounded: 'full',
    borderWidth: '1px',
    borderColor: 'border',
    px: '2.5',
    py: '0.5',
    fontSize: '11px',
    fontWeight: 'medium',
    letterSpacing: 'wide',
    transitionProperty: 'colors',
    transitionDuration: '150ms',
    transitionTimingFunction: 'default',
    outline: 'none',
    '& > svg': { boxSize: '3', pointerEvents: 'none' },
    _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 50%, transparent)' },
  },
  variants: {
    variant: {
      default: {
        bg: 'primary/12',
        color: 'primary',
        borderColor: 'primary/25',
        '&:is(a):hover': { bg: 'primary/20' },
      },
      secondary: {
        bg: 'secondary',
        color: 'secondary.foreground',
        borderColor: 'border/50',
        '&:is(a):hover': { bg: 'secondary/80' },
      },
      destructive: {
        bg: 'destructive/12',
        color: 'destructive',
        borderColor: 'destructive/25',
        '&:is(a):hover': { bg: 'destructive/20' },
      },
      outline: {
        borderColor: 'border',
        color: 'muted.foreground',
        '&:is(a):hover': { bg: 'accent', color: 'accent.foreground' },
      },
      ghost: {
        borderColor: 'transparent',
        color: 'muted.foreground',
        '&:is(a):hover': { bg: 'accent', color: 'foreground' },
      },
      link: {
        borderColor: 'transparent',
        color: 'primary',
        textUnderlineOffset: '4px',
        '&:is(a):hover': { textDecoration: 'underline' },
      },
      positive: { bg: 'positive/12', color: 'positive', borderColor: 'positive/25' },
      warning: { bg: 'warning/14', color: 'warning', borderColor: 'warning/28' },
      ai: { bg: 'ai/12', color: 'ai', borderColor: 'ai/25' },
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

type BadgeVariant = NonNullable<RecipeVariantProps<typeof badgeRecipe>>['variant']

type BadgeProps = HTMLStyledProps<'span'> & {
  variant?: BadgeVariant
  asChild?: boolean
}

const StyledBadge = styled('span', badgeRecipe)
const StyledSlotBadge = styled(Slot.Root, badgeRecipe)

function Badge({ variant = 'default', asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? StyledSlotBadge : StyledBadge
  return <Comp data-slot="badge" data-variant={variant} variant={variant} {...props} />
}

/** Class-string form of the badge recipe, for non-JSX call sites. */
const badgeVariants = badgeRecipe

export { Badge, type BadgeProps, type BadgeVariant, badgeVariants }
