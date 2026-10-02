import { cva, type RecipeVariantProps } from '@finance-os/styled-system/css'
import { type HTMLStyledProps, styled } from '@finance-os/styled-system/jsx'
import { Slot } from 'radix-ui'

const buttonRecipe = cva({
  // Shared control geometry, interaction, and keyboard focus treatment.
  base: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    whiteSpace: 'nowrap',
    rounded: 'lg',
    fontWeight: 'medium',
    userSelect: 'none',
    cursor: 'pointer',
    flexShrink: '0',
    transitionProperty: 'transform, box-shadow, background, color, border-color',
    transitionDuration: '150ms',
    transitionTimingFunction: 'out',
    outline: 'none',
    '& svg': { pointerEvents: 'none', flexShrink: '0' },
    '& svg:not([class*="size-"])': { boxSize: '4' },
    _disabled: { pointerEvents: 'none', opacity: '0.4' },
    _focusVisible: {
      boxShadow:
        '0 0 0 2px {colors.background}, 0 0 0 4px color-mix(in srgb, {colors.ring} 70%, transparent)',
    },
    _active: { scale: '0.97' },
  },
  variants: {
    variant: {
      default: {
        // Signal-orange primary action.
        bg: 'primary',
        color: 'primary.foreground',
        boxShadow: '0 1px 2px oklch(0 0 0 / 18%), inset 0 1px 0 oklch(1 0 0 / 18%)',
        _hover: {
          boxShadow:
            '0 6px 18px -4px oklch(from {colors.primary} l c h / 45%), inset 0 1px 0 oklch(1 0 0 / 22%)',
          filter: 'brightness(1.06)',
        },
      },
      destructive: {
        bg: 'destructive',
        color: 'white',
        boxShadow: '0 1px 2px oklch(0 0 0 / 16%)',
        _hover: { filter: 'brightness(1.06)' },
        _focusVisible: {
          boxShadow:
            '0 0 0 2px {colors.background}, 0 0 0 4px color-mix(in srgb, {colors.destructive} 50%, transparent)',
        },
      },
      outline: {
        borderWidth: '1px',
        borderColor: 'border',
        bg: 'transparent',
        shadow: 'xs',
        _hover: { bg: 'accent/60', borderColor: 'primary/30', color: 'primary', shadow: 'sm' },
      },
      soft: {
        // Quiet brand-tinted secondary action.
        bg: 'primary/10',
        color: 'primary',
        borderWidth: '1px',
        borderColor: 'primary/20',
        _hover: { bg: 'primary/15', borderColor: 'primary/30' },
      },
      secondary: {
        bg: 'secondary',
        color: 'secondary.foreground',
        borderWidth: '1px',
        borderColor: 'border/40',
        _hover: { bg: 'secondary/70', shadow: 'xs' },
      },
      ghost: {
        color: 'muted.foreground',
        _hover: { bg: 'accent/50', color: 'foreground' },
      },
      link: {
        color: 'primary',
        textUnderlineOffset: '4px',
        _hover: { textDecorationLine: 'underline' },
        _active: { scale: '1' },
      },
    },
    // Typography lives on the size: the former `text-sm` base was replaced (not
    // combined) by each size's own `text-*` class, so `lg`/`xl` keep the inherited
    // line height and the small sizes use the `xs` metrics.
    size: {
      default: { h: '9', px: '4', py: '2', textStyle: 'sm', '&:has(> svg)': { px: '3' } },
      xs: {
        h: '6',
        gap: '1',
        rounded: 'md',
        px: '2',
        textStyle: 'xs',
        '&:has(> svg)': { px: '1.5' },
        '& svg:not([class*="size-"])': { boxSize: '3' },
      },
      sm: {
        h: '8',
        rounded: 'md',
        gap: '1.5',
        px: '3',
        textStyle: 'xs',
        '&:has(> svg)': { px: '2.5' },
      },
      lg: {
        h: '11',
        rounded: 'xl',
        px: '6',
        fontSize: '15px',
        lineHeight: 'inherit',
        '&:has(> svg)': { px: '4' },
      },
      xl: {
        h: '12',
        rounded: 'xl',
        px: '7',
        fontSize: '15px',
        lineHeight: 'inherit',
        fontWeight: 'semibold',
        '&:has(> svg)': { px: '5' },
      },
      icon: { boxSize: '9', textStyle: 'sm' },
      'icon-xs': {
        boxSize: '6',
        rounded: 'md',
        textStyle: 'sm',
        '& svg:not([class*="size-"])': { boxSize: '3' },
      },
      'icon-sm': { boxSize: '8', textStyle: 'sm' },
      'icon-lg': { boxSize: '10', textStyle: 'sm' },
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

type ButtonVariantProps = NonNullable<RecipeVariantProps<typeof buttonRecipe>>
type ButtonVariant = ButtonVariantProps['variant']
type ButtonSize = ButtonVariantProps['size']

type ButtonProps = HTMLStyledProps<'button'> & {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const StyledButton = styled('button', buttonRecipe)
const StyledSlotButton = styled(Slot.Root, buttonRecipe)

function Button({ variant = 'default', size = 'default', asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? StyledSlotButton : StyledButton

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      variant={variant}
      size={size}
      {...props}
    />
  )
}

/** Class-string form of the button recipe, for non-JSX call sites. */
const buttonVariants = buttonRecipe

export { Button, type ButtonProps, type ButtonSize, type ButtonVariant, buttonVariants }
