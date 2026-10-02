import { styled } from '@finance-os/styled-system/jsx'
import type { ReactNode } from 'react'

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PersonalSectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: SectionHeadingProps) {
  return (
    <styled.div
      display="flex"
      flexDirection="column"
      gap="3"
      sm={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}
    >
      <styled.div minW="0">
        {eyebrow ? (
          <styled.p
            fontFamily="mono"
            fontSize="10px"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="0.22em"
            color="primary/65"
          >
            {eyebrow}
          </styled.p>
        ) : null}
        <styled.h2
          mt="1"
          textStyle="xl"
          fontWeight="semibold"
          letterSpacing="tight"
          color="foreground"
        >
          {title}
        </styled.h2>
        {description ? (
          <styled.p mt="1" maxW="2xl" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
            {description}
          </styled.p>
        ) : null}
      </styled.div>
      {actions ? (
        <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2">
          {actions}
        </styled.div>
      ) : null}
    </styled.div>
  )
}

export function PersonalEmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <styled.div
      rounded="frame"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border/45"
      bg="surface.1/35"
      px="4"
      py="8"
      textAlign="center"
    >
      <styled.p textStyle="sm" fontWeight="semibold" color="foreground">
        {title}
      </styled.p>
      <styled.p
        mx="auto"
        mt="1"
        maxW="md"
        textStyle="sm"
        lineHeight="relaxed"
        color="muted.foreground"
      >
        {description}
      </styled.p>
      {action ? (
        <styled.div mt="4" display="flex" justifyContent="center">
          {action}
        </styled.div>
      ) : null}
    </styled.div>
  )
}
