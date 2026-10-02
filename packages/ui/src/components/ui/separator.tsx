import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Separator as SeparatorPrimitive } from 'radix-ui'
import type * as React from 'react'

const separatorRecipe = cva({
  base: {
    bg: 'border',
    flexShrink: '0',
    '&[data-orientation=horizontal]': { h: '1px', w: 'full' },
    '&[data-orientation=vertical]': { h: 'full', w: '1px' },
  },
})

const StyledSeparator = styled(SeparatorPrimitive.Root, separatorRecipe)

function Separator({
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof StyledSeparator>) {
  return (
    <StyledSeparator
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      {...props}
    />
  )
}

export { Separator }
