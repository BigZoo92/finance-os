import { Button } from '@finance-os/ui/components'
import { ChevronUpPixelIcon } from '@finance-os/ui/icons/pixel'
import { forwardRef, type KeyboardEvent } from 'react'

export type AdvisorChatSendNotice = {
  tone: 'neutral' | 'warning'
  message: string
}

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
    <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/55 bg-background/95 px-1 pb-1 pt-3 backdrop-blur sm:px-4 sm:pb-2">
      <form
        onSubmit={event => {
          event.preventDefault()
          onSend()
        }}
        className="flex items-end gap-2 rounded-xl border border-border/70 bg-card/50 p-2 shadow-sm focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10"
      >
        <label htmlFor="advisor-chat-composer" className="sr-only">
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
          className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground/65 disabled:cursor-not-allowed disabled:opacity-55"
        />
        <Button
          type="submit"
          size="icon-lg"
          variant="soft"
          disabled={!canSend || sending || !value.trim()}
          aria-label={sending ? 'Envoi en cours' : 'Envoyer le message'}
          className="size-11 shrink-0"
        >
          <ChevronUpPixelIcon size={15} aria-hidden="true" />
        </Button>
      </form>
      <p id="advisor-chat-composer-hint" className="sr-only">
        {composerHint}
      </p>
      <p
        id="advisor-chat-send-status"
        aria-live="polite"
        className={`min-h-5 px-1 pt-1 text-xs ${
          notice?.tone === 'warning' ? 'text-warning' : 'text-muted-foreground'
        }`}
      >
        {statusMessage}
      </p>
    </div>
  )
})
