import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'

/**
 * Card is the quiet general-purpose Command Pixel surface.
 *
 * Every part is a styled element: consumers adjust spacing and layout with
 * style props (`<Card mt="4">`) and never need to reach into the recipe.
 */
const cardRoot = cva({
  base: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '6',
    rounded: 'frame',
    borderWidth: '1px',
    borderColor: 'border/60',
    py: '6',
    bg: 'card',
    color: 'card.foreground',
    boxShadow: '0 1px 2px oklch(0 0 0 / 4%), 0 6px 20px -8px oklch(0 0 0 / 6%)',
  },
})

const cardHeader = cva({
  base: {
    containerType: 'inline-size',
    containerName: 'card-header',
    display: 'grid',
    gridAutoRows: 'min-content',
    gridTemplateRows: 'auto auto',
    alignItems: 'start',
    gap: '1.5',
    px: '6',
    '&:has([data-slot=card-action])': { gridTemplateColumns: '1fr auto' },
    '&.border-b': { pb: '6' },
  },
})

const cardTitle = cva({
  base: { lineHeight: 'none', fontWeight: 'semibold', letterSpacing: 'tight' },
})

const cardDescription = cva({
  base: { color: 'muted.foreground', textStyle: 'sm', lineHeight: 'relaxed' },
})

const cardAction = cva({
  base: {
    gridColumnStart: '2',
    gridRow: 'span 2 / span 2',
    gridRowStart: '1',
    alignSelf: 'start',
    justifySelf: 'end',
  },
})

const cardContent = cva({ base: { px: '6' } })

const cardFooter = cva({
  base: { display: 'flex', alignItems: 'center', px: '6', '&.border-t': { pt: '6' } },
})

const Card = styled('div', cardRoot, { defaultProps: { 'data-slot': 'card' } })
const CardHeader = styled('div', cardHeader, { defaultProps: { 'data-slot': 'card-header' } })
const CardTitle = styled('div', cardTitle, { defaultProps: { 'data-slot': 'card-title' } })
const CardDescription = styled('div', cardDescription, {
  defaultProps: { 'data-slot': 'card-description' },
})
const CardAction = styled('div', cardAction, { defaultProps: { 'data-slot': 'card-action' } })
const CardContent = styled('div', cardContent, { defaultProps: { 'data-slot': 'card-content' } })
const CardFooter = styled('div', cardFooter, { defaultProps: { 'data-slot': 'card-footer' } })

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
