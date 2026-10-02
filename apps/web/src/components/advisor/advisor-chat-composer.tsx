import { css, cva } from '@finance-os/styled-system/css'
import { Button } from '@finance-os/ui/components'
import { ChevronUpPixelIcon } from '@finance-os/ui/icons/pixel'
import { forwardRef, type KeyboardEvent } from 'react'

export type AdvisorChatSendNotice = {
  tone: 'neutral' | 'warning'
  message: string
}

const visuallyHidden = css({ srOnly: true })

const composerShell = css({
  position: 'sticky',
  bottom: '0',
  zIndex: '10',
  flexShrink: '0',
  borderTopWidth: '1px',
  borderColor: 'border/55',
  bg: 'background/95',
  px: '1',
  pb: '1',
  pt: '3',
  backdropFilter: 'blur(8px)',
  sm: { px: '4', pb: '2' },
})

// While the textarea has focus, the 2px ring sits above the resting `sm` shadow.
const composerForm = css({
  display: 'flex',
  alignItems: 'flex-end',
  gap: '2',
  rounded: 'xl',
  borderWidth: '1px',
  borderColor: 'border/70',
  bg: 'card/50',
  p: '2',
  shadow: 'sm',
  _focusWithin: {
    borderColor: 'primary/45',
    boxShadow: '0 0 0 2px color-mix(in srgb, {colors.primary} 10%, transparent), {shadows.sm}',
  },
})

const composerTextarea = css({
  maxH: '36',
  minH: '10',
  flex: '1',
  resize: 'none',
  bg: 'transparent',
  px: '2',
  py: '2.5',
  textStyle: 'sm',
  lineHeight: '1.25rem',
  color: 'foreground',
  outlineStyle: 'none',
  _placeholder: { color: 'muted.foreground/65' },
  _disabled: { cursor: 'not-allowed', opacity: '0.55' },
})

const sendStatus = cva({
  base: { minH: '5', px: '1', pt: '1', textStyle: 'xs' },
  variants: {
    tone: {
      neutral: { color: 'muted.foreground' },
      warning: { color: 'warning' },
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export const AdvisorChatComposer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string
    canSend: boolean
    sending: boolean
    notice: AdvisorChatSendNotice | null
    onChange: (value: string) => void
    onSend: () => void
  }
>(function AdvisorChatComposer(
  { value, canSend, sending, notice, onChange, onSend },
  forwardedRef
) {
  const composerHint = 'Entrée pour envoyer. Maj et Entrée pour une nouvelle ligne.'
  const statusMessage = notice?.message ?? (!canSend ? 'Le chat est en lecture seule.' : '')

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    onSend()
  }

  return (
    <div className={composerShell}>
      <form
        onSubmit={event => {
          event.preventDefault()
          onSend()
        }}
        className={composerForm}
      >
        <label htmlFor="advisor-chat-composer" className={visuallyHidden}>
          Écrire à Finance-OS
        </label>
        <textarea
          ref={forwardedRef}
          id="advisor-chat-composer"
          rows={1}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-describedby={
            statusMessage ? 'advisor-chat-send-status' : 'advisor-chat-composer-hint'
          }
          placeholder="Écrire à Finance-OS"
          disabled={!canSend || sending}
          className={composerTextarea}
        />
        <Button
          type="submit"
          size="icon-lg"
          variant="soft"
          disabled={!canSend || sending || !value.trim()}
          aria-label={sending ? 'Envoi en cours' : 'Envoyer le message'}
          boxSize="11"
          flexShrink="0"
        >
          <ChevronUpPixelIcon size={15} aria-hidden="true" />
        </Button>
      </form>
      <p id="advisor-chat-composer-hint" className={visuallyHidden}>
        {composerHint}
      </p>
      <p
        id="advisor-chat-send-status"
        aria-live="polite"
        className={sendStatus({ tone: notice?.tone === 'warning' ? 'warning' : 'neutral' })}
      >
        {statusMessage}
      </p>
    </div>
  )
})
