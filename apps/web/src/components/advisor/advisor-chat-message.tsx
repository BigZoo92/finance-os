import { ChevronDownPixelIcon } from '@finance-os/ui/icons/pixel'
import type { ReactNode } from 'react'
import {
  type AdvisorChatMessageViewModel,
  toAdvisorChatMessageViewModel,
} from '@/features/advisor-chat-view-model'
import type { DashboardAdvisorChatMessageResponse } from '@/features/dashboard-types'

export function AdvisorChatMessage({ message }: { message: DashboardAdvisorChatMessageResponse }) {
  const viewModel = toAdvisorChatMessageViewModel(message)

  if (viewModel.author.kind === 'user') {
    return <UserMessage content={viewModel.content} />
  }

  if (viewModel.author.kind === 'notice') {
    return (
      <div className="mx-auto max-w-[620px] border-l-2 border-border px-3 py-1 text-sm leading-relaxed text-muted-foreground">
        <span className="sr-only">{viewModel.author.label} : </span>
        {viewModel.content}
      </div>
    )
  }

  return <FinanceOsResponse message={viewModel} />
}

export function UserMessage({ content, pending = false }: { content: string; pending?: boolean }) {
  return (
    <div className="ml-auto w-fit max-w-[88%] rounded-xl border border-border/65 bg-surface-1 px-4 py-3 text-sm leading-relaxed text-foreground sm:max-w-[72%]">
      <span className="sr-only">Vous : </span>
      <p className="whitespace-pre-wrap">{content}</p>
      {pending ? <span className="sr-only">Envoi en cours</span> : null}
    </div>
  )
}

function FinanceOsResponse({ message }: { message: AdvisorChatMessageViewModel }) {
  const details = message.details

  return (
    <article className="max-w-[620px] text-foreground">
      <span className="sr-only">Finance-OS : </span>
      <p className="whitespace-pre-wrap text-[15px] leading-7">{message.content}</p>

      {details?.simulations ? (
        <section className="mt-5 border-y border-border/55 py-3" aria-label="Estimation">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {details.simulations.stateLabel}
            </h3>
            <span className="text-[11px] text-warning">Hypothétique</span>
          </div>
          <dl className="divide-y divide-border/45">
            {details.simulations.items.map(item => (
              <div key={`${item.label}-${item.value}`} className="flex gap-4 py-2 text-sm">
                <dt className="min-w-0 flex-1 text-muted-foreground">{item.label}</dt>
                <dd className="font-financial text-right text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {details.simulations.description}
          </p>
        </section>
      ) : null}

      {details?.caveats?.length ? (
        <section
          className="mt-4 border-l-2 border-warning/65 pl-3"
          aria-label="Points de vigilance"
        >
          <h3 className="text-xs font-medium text-warning">À vérifier</h3>
          <ul className="mt-1 space-y-1 text-sm leading-relaxed text-muted-foreground">
            {details.caveats.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {details?.assumptions?.length ? (
        <MessageDetails label="Hypothèses">
          <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {details.assumptions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </MessageDetails>
      ) : null}

      {details?.citations?.length ? (
        <MessageDetails label="Références mentionnées">
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {details.citations.map(item => (
              <li key={item.label}>{item.label}</li>
            ))}
          </ul>
        </MessageDetails>
      ) : null}
    </article>
  )
}

function MessageDetails({ children, label }: { children: ReactNode; label: string }) {
  return (
    <details className="group mt-3 border-t border-border/45 pt-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDownPixelIcon
          size={12}
          aria-hidden="true"
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="pb-1 pt-2">{children}</div>
    </details>
  )
}

export function ChatResponsePending() {
  return (
    <output className="block max-w-[620px]" aria-live="polite">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Réponse en cours
      </p>
      <span className="mt-3 flex gap-1" aria-hidden="true">
        <span className="size-1.5 animate-pulse bg-muted-foreground/35 motion-reduce:animate-none" />
        <span className="size-1.5 animate-pulse bg-primary motion-reduce:animate-none [animation-delay:120ms]" />
        <span className="size-1.5 animate-pulse bg-muted-foreground/35 motion-reduce:animate-none [animation-delay:240ms]" />
      </span>
    </output>
  )
}
