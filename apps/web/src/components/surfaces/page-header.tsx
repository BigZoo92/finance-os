/**
 * PageHeader — canonical header for internal pages.
 *
 * Command Pixel scale: Geist Mono uppercase eyebrow, 24px Geist Sans
 * semibold title. Identical across pages so navigation keeps titles
 * visually anchored.
 */
import { css, cva, cx } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  status?: ReactNode
  /** Tightens vertical rhythm — used for dense sub-pages. */
  compact?: boolean
  className?: string
}

const headerRoot = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  sm: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
})

const pageTitle = cva({
  base: {
    fontWeight: 'semibold',
    letterSpacing: 'tight',
    color: 'foreground',
    lineHeight: 'tight',
  },
  variants: {
    compact: {
      true: { textStyle: 'xl' },
      false: { textStyle: '2xl' },
    },
    withEyebrow: {
      true: { mt: '2.5' },
      false: {},
    },
  },
})

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  status,
  compact,
  className,
}: PageHeaderProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.header
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cx(headerRoot, className)}
    >
      <styled.div minW="0" flex="1">
        {eyebrow && (
          <styled.p
            display="flex"
            alignItems="center"
            gap="2"
            fontFamily="mono"
            fontSize="11px"
            textTransform="uppercase"
            letterSpacing="0.16em"
            color="muted.foreground"
          >
            {icon && (
              <styled.span display="flex" alignItems="center" color="primary/80" aria-hidden="true">
                {icon}
              </styled.span>
            )}
            {eyebrow}
          </styled.p>
        )}
        <h1 className={pageTitle({ compact: Boolean(compact), withEyebrow: Boolean(eyebrow) })}>
          {title}
        </h1>
        {description && (
          <styled.p
            mt="2"
            maxW="prose"
            fontSize="13px"
            color="muted.foreground"
            lineHeight="relaxed"
          >
            {description}
          </styled.p>
        )}
        {status && <styled.div mt="3">{status}</styled.div>}
      </styled.div>
      {actions && (
        <styled.div display="flex" flexWrap="wrap" alignItems="center" gap="2">
          {actions}
        </styled.div>
      )}
    </motion.header>
  )
}

export default PageHeader
