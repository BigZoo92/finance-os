import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'

const inputRecipe = cva({
  base: {
    // base
    h: '10',
    w: 'full',
    minW: '0',
    rounded: 'lg',
    borderWidth: '1px',
    borderColor: 'border/70',
    bg: 'surface.1',
    px: '3',
    py: '1',
    textStyle: 'sm',
    shadow: 'xs',
    outline: 'none',
    color: 'foreground',
    _placeholder: { color: 'muted.foreground' },
    _dark: { bg: 'input/30' },
    transitionProperty: 'color, box-shadow, border-color, background',
    transitionDuration: '150ms',
    transitionTimingFunction: 'out',
    // file inputs
    _file: {
      display: 'inline-flex',
      h: '8',
      borderWidth: '0',
      bg: 'transparent',
      textStyle: 'sm',
      fontWeight: 'medium',
      color: 'foreground',
    },
    // selection
    _selection: { bg: 'primary/25', color: 'foreground' },
    // disabled
    _disabled: { pointerEvents: 'none', cursor: 'not-allowed', opacity: '0.5' },
    // focus — rose ring instead of vanilla (ring sits above the resting xs shadow)
    _focusVisible: {
      borderColor: 'primary/50',
      boxShadow: '0 0 0 3px color-mix(in srgb, {colors.primary} 25%, transparent), {shadows.xs}',
    },
    // invalid (wins over the focus border, like the Tailwind variant order)
    '&[aria-invalid=true]': {
      borderColor: 'destructive',
      _focusVisible: {
        borderColor: 'destructive',
        boxShadow:
          '0 0 0 3px color-mix(in srgb, {colors.destructive} 25%, transparent), {shadows.xs}',
      },
      _dark: {
        _focusVisible: {
          boxShadow:
            '0 0 0 3px color-mix(in srgb, {colors.destructive} 40%, transparent), {shadows.xs}',
        },
      },
    },
    // tablet/desktop tighten
    md: { fontSize: '13px' },
  },
})

const Input = styled('input', inputRecipe, { defaultProps: { 'data-slot': 'input' } })

export { Input }
