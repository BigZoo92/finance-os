import { css, cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { ChevronDownPixelIcon } from '@finance-os/ui/icons/pixel'
import type { ReactNode } from 'react'
import {
  type AdvisorChatMessageViewModel,
  toAdvisorChatMessageViewModel,
} from '@/features/advisor-chat-view-model'
import type { DashboardAdvisorChatMessageResponse } from '@/features/dashboard-types'

const visuallyHidden = css({ srOnly: true })

const eyebrow = css({
  fontFamily: 'mono',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: 'muted.foreground',
})

const noticeMessage = css({
  mx: 'auto',
  maxW: '620px',
  borderLeftWidth: '2px',
  borderColor: 'border',
  px: '3',
  py: '1',
  textStyle: 'sm',
  lineHeight: 'relaxed',
  color: 'muted.foreground',
})

const userBubble = css({
  ml: 'auto',
  w: 'fit',
  maxW: '88%',
  rounded: 'xl',
  borderWidth: '1px',
  borderColor: 'border/65',
  bg: 'surface.1',
  px: '4',
  py: '3',
  textStyle: 'sm',
  lineHeight: 'relaxed',
  color: 'foreground',
  sm: { maxW: '72%' },
})

// Tailwind's `divide-y` drew the rule under every item but the last.
const simulationList = css({
  '& > :not(:last-child)': { borderBottomWidth: '1px', borderColor: 'border/45' },
})

const disclosureSummary = css({
  display: 'flex',
  minH: '11',
  cursor: 'pointer',
  listStyleType: 'none',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  textStyle: 'xs',
  fontWeight: 'medium',
  color: 'muted.foreground',
  outlineStyle: 'none',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _hover: { color: 'foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
  '&::-webkit-details-marker': { display: 'none' },
})

// The chevron follows the open state of its `<details>` group.
const disclosureChevron = css({
  transitionProperty: 'transform, translate, scale, rotate',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  '[data-group=disclosure][open] &': { rotate: '180deg' },
  _motionReduce: { transitionProperty: 'none' },
})

const pendingDot = cva({
  base: {
    boxSize: '1.5',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    _motionReduce: { animation: 'none' },
  },
  variants: {
    tone: {
      muted: { bg: 'muted.foreground/35' },
      primary: { bg: 'primary' },
    },
    delay: {
      none: {},
      short: { animationDelay: '120ms' },
      long: { animationDelay: '240ms' },
    },
  },
  defaultVariants: { tone: 'muted', delay: 'none' },
})

const PendingDot = styled('span', pendingDot)

export function AdvisorChatMessage({ message }: { message: DashboardAdvisorChatMessageResponse }) {
  const viewModel = toAdvisorChatMessageViewModel(message)

  if (viewModel.author.kind === 'user') {
    return <UserMessage content={viewModel.content} />
  }

  if (viewModel.author.kind === 'notice') {
    return (
      <div className={noticeMessage}>
        <span className={visuallyHidden}>{viewModel.author.label} : </span>
        {viewModel.content}
      </div>
    )
  }

  return <FinanceOsResponse message={viewModel} />
}

export function UserMessage({ content, pending = false }: { content: string; pending?: boolean }) {
  return (
    <div className={userBubble}>
      <span className={visuallyHidden}>Vous : </span>
      <styled.p whiteSpace="pre-wrap">{content}</styled.p>
      {pending ? <span className={visuallyHidden}>Envoi en cours</span> : null}
    </div>
  )
}

function FinanceOsResponse({ message }: { message: AdvisorChatMessageViewModel }) {
  const details = message.details

  return (
    <styled.article maxW="620px" color="foreground">
      <span className={visuallyHidden}>Finance-OS : </span>
      <styled.p whiteSpace="pre-wrap" fontSize="15px" lineHeight="1.75rem">
        {message.content}
      </styled.p>

      {details?.simulations ? (
        <styled.section
          mt="5"
          borderYWidth="1px"
          borderColor="border/55"
          py="3"
          aria-label="Estimation"
        >
          <styled.div
            mb="2"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="3"
          >
            <h3 className={eyebrow}>{details.simulations.stateLabel}</h3>
            <styled.span fontSize="11px" color="warning">
              Hypothétique
            </styled.span>
          </styled.div>
          <dl className={simulationList}>
            {details.simulations.items.map(item => (
              <styled.div
                key={`${item.label}-${item.value}`}
                display="flex"
                gap="4"
                py="2"
                textStyle="sm"
              >
                <styled.dt minW="0" flex="1" color="muted.foreground">
                  {item.label}
                </styled.dt>
                <styled.dd textStyle="financial" textAlign="right" color="foreground">
                  {item.value}
                </styled.dd>
              </styled.div>
            ))}
          </dl>
          <styled.p mt="2" textStyle="xs" lineHeight="relaxed" color="muted.foreground">
            {details.simulations.description}
          </styled.p>
        </styled.section>
      ) : null}

      {details?.caveats?.length ? (
        <styled.section
          mt="4"
          borderLeftWidth="2px"
          borderColor="warning/65"
          pl="3"
          aria-label="Points de vigilance"
        >
          <styled.h3 textStyle="xs" fontWeight="medium" color="warning">
            À vérifier
          </styled.h3>
          <styled.ul mt="1" spaceY="1" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
            {details.caveats.map(item => (
              <li key={item}>{item}</li>
            ))}
          </styled.ul>
        </styled.section>
      ) : null}

      {details?.assumptions?.length ? (
        <MessageDetails label="Hypothèses">
          <styled.ul spaceY="1.5" textStyle="sm" lineHeight="relaxed" color="muted.foreground">
            {details.assumptions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </styled.ul>
        </MessageDetails>
      ) : null}

      {details?.citations?.length ? (
        <MessageDetails label="Références mentionnées">
          <styled.ul spaceY="1.5" textStyle="sm" color="muted.foreground">
            {details.citations.map(item => (
              <li key={item.label}>{item.label}</li>
            ))}
          </styled.ul>
        </MessageDetails>
      ) : null}
    </styled.article>
  )
}

function MessageDetails({ children, label }: { children: ReactNode; label: string }) {
  return (
    <styled.details
      data-group="disclosure"
      mt="3"
      borderTopWidth="1px"
      borderColor="border/45"
      pt="3"
    >
      <summary className={disclosureSummary}>
        {label}
        <ChevronDownPixelIcon size={12} aria-hidden="true" className={disclosureChevron} />
      </summary>
      <styled.div pb="1" pt="2">
        {children}
      </styled.div>
    </styled.details>
  )
}

export function ChatResponsePending() {
  return (
    <styled.output display="block" maxW="620px" aria-live="polite">
      <p className={eyebrow}>Réponse en cours</p>
      <styled.span mt="3" display="flex" gap="1" aria-hidden="true">
        <PendingDot />
        <PendingDot tone="primary" delay="short" />
        <PendingDot delay="long" />
      </styled.span>
    </styled.output>
  )
}
