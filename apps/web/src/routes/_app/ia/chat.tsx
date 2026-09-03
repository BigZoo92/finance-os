import { CommentPixelIcon } from '@finance-os/ui/icons/pixel'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  AdvisorChatComposer,
  type AdvisorChatSendNotice,
} from '@/components/advisor/advisor-chat-composer'
import {
  AdvisorChatMessage,
  ChatResponsePending,
  UserMessage,
} from '@/components/advisor/advisor-chat-message'
import { ADVISOR_CHAT_EMPTY_SUGGESTIONS } from '@/features/advisor-chat-view-model'
import { getAiAdvisorUiFlags } from '@/features/ai-advisor-config'
import { authMeQueryOptions } from '@/features/auth-query-options'
import type { AuthMode } from '@/features/auth-types'
import { resolveAuthViewState } from '@/features/auth-view-state'
import { postDashboardAdvisorChat } from '@/features/dashboard-api'
import {
  dashboardAdvisorChatQueryOptionsWithMode,
  dashboardAdvisorQueryOptionsWithMode,
} from '@/features/dashboard-query-options'
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion'

const advisorThreadKey = 'default'

type SendVariables = {
  message: string
  knownMessageIds: ReadonlySet<number>
}

export const Route = createFileRoute('/_app/ia/chat')({
  loader: async ({ context }) => {
    const auth = await context.queryClient.fetchQuery(authMeQueryOptions())
    const mode: AuthMode | undefined =
      auth.mode === 'admin' ? 'admin' : auth.mode === 'demo' ? 'demo' : undefined
    if (!mode) return

    const flags = getAiAdvisorUiFlags()
    const visible = flags.enabled && (!flags.adminOnly || mode === 'admin')
    if (!visible) return

    await Promise.allSettled([
      context.queryClient.ensureQueryData(
        dashboardAdvisorQueryOptionsWithMode({ mode, range: '30d' })
      ),
      context.queryClient.ensureQueryData(
        dashboardAdvisorChatQueryOptionsWithMode({ mode, threadKey: advisorThreadKey })
      ),
    ])
  },
  component: IaChatPage,
})

function IaChatPage() {
  const queryClient = useQueryClient()
  const prefersReducedMotion = usePrefersReducedMotion()
  const authQuery = useQuery(authMeQueryOptions())
  const authViewState = resolveAuthViewState({
    isPending: authQuery.isPending,
    ...(authQuery.data?.mode ? { mode: authQuery.data.mode } : {}),
  })
  const isDemo = authViewState === 'demo'
  const isAdmin = authViewState === 'admin'
  const authMode: AuthMode | undefined = isAdmin ? 'admin' : isDemo ? 'demo' : undefined
  const flags = getAiAdvisorUiFlags()
  const visible = flags.enabled && (!flags.adminOnly || isAdmin)
  const modeOptions = visible && authMode ? { mode: authMode } : {}
  const chatOptions = dashboardAdvisorChatQueryOptionsWithMode({
    ...modeOptions,
    threadKey: advisorThreadKey,
  })

  const [draft, setDraft] = useState('')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [sendNotice, setSendNotice] = useState<AdvisorChatSendNotice | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollRegionRef = useRef<HTMLDivElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const shouldFollowConversationRef = useRef(true)

  const chatQuery = useQuery({
    ...chatOptions,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })
  const overviewQuery = useQuery(
    dashboardAdvisorQueryOptionsWithMode({ ...modeOptions, range: '30d' })
  )
  const messages = chatQuery.data?.messages ?? []
  const canSend = isAdmin && overviewQuery.data?.chatEnabled === true

  const chatMutation = useMutation({
    mutationFn: ({ message }: SendVariables) =>
      postDashboardAdvisorChat({ threadKey: advisorThreadKey, message }),
    retry: false,
    onSuccess: (result, variables) => {
      queryClient.setQueryData(chatOptions.queryKey, result.thread)
      setDraft(current => (current.trim() === variables.message ? '' : current))
      setPendingMessage(null)
      setSendNotice(null)
    },
    onError: async (_error, variables) => {
      setPendingMessage(null)

      if (!authMode) {
        setSendNotice({
          tone: 'warning',
          message: 'Envoi non confirmé. Vérifiez la conversation avant de renvoyer.',
        })
        return
      }

      try {
        const refreshed = await queryClient.fetchQuery({
          ...dashboardAdvisorChatQueryOptionsWithMode({
            mode: authMode,
            threadKey: advisorThreadKey,
          }),
          staleTime: 0,
        })
        const recovered = refreshed.messages.some(
          message =>
            message.role === 'user' &&
            !variables.knownMessageIds.has(message.id) &&
            message.content.trim() === variables.message
        )

        if (recovered) {
          setDraft(current => (current.trim() === variables.message ? '' : current))
          setSendNotice({
            tone: 'neutral',
            message: 'Message retrouvé dans la conversation.',
          })
          return
        }
      } catch {
        // The draft stays intact when reconciliation is unavailable.
      }

      setSendNotice({
        tone: 'warning',
        message: 'Envoi non confirmé. Vérifiez la conversation avant de renvoyer.',
      })
    },
  })

  useEffect(() => {
    void draft
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [draft])

  const conversationVersion = `${messages.length}:${pendingMessage ?? ''}`

  useEffect(() => {
    void conversationVersion
    if (!shouldFollowConversationRef.current) return
    conversationEndRef.current?.scrollIntoView({
      block: 'end',
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [conversationVersion, prefersReducedMotion])

  const sendMessage = () => {
    const message = draft.trim()
    if (!message || !canSend || chatMutation.isPending) return

    shouldFollowConversationRef.current = true
    setPendingMessage(message)
    setSendNotice(null)
    chatMutation.reset()
    chatMutation.mutate({
      message,
      knownMessageIds: new Set(messages.map(item => item.id)),
    })
  }

  const handleConversationScroll = () => {
    const region = scrollRegionRef.current
    if (!region) return
    const remaining = region.scrollHeight - region.scrollTop - region.clientHeight
    shouldFollowConversationRef.current = remaining < 96
  }

  const selectSuggestion = (suggestion: string) => {
    setDraft(suggestion)
    setSendNotice(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  if (!visible) {
    return (
      <ChatShell>
        <ChatEmptyState
          title="Chat indisponible"
          description="Advisor n’est pas disponible dans cette session."
        />
      </ChatShell>
    )
  }

  const isInitialLoading = chatQuery.isPending && messages.length === 0
  const isUnavailable = chatQuery.isError && messages.length === 0

  return (
    <ChatShell>
      <div
        ref={scrollRegionRef}
        onScroll={handleConversationScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-5 sm:px-4 sm:py-7"
      >
        {isInitialLoading ? <ChatLoadingState /> : null}

        {isUnavailable ? (
          <ChatEmptyState
            title="Conversation indisponible"
            description="Réessayez dans quelques instants. Votre brouillon reste local."
          />
        ) : null}

        {!isInitialLoading && !isUnavailable && messages.length === 0 && !pendingMessage ? (
          <ChatEmptyState
            title={canSend ? 'Que voulez-vous savoir ?' : 'Conversation en lecture seule'}
            {...(!canSend
              ? {
                  description: isDemo
                    ? 'Le chat ne crée aucun message dans la démonstration.'
                    : 'L’envoi de messages est désactivé pour cette session.',
                }
              : {})}
            {...(canSend
              ? {
                  suggestions: ADVISOR_CHAT_EMPTY_SUGGESTIONS,
                  onSelectSuggestion: selectSuggestion,
                }
              : {})}
          />
        ) : null}

        {messages.length > 0 ? (
          <ol aria-label="Conversation" className="space-y-8 sm:space-y-10">
            {messages.map(message => (
              <li key={message.id}>
                <AdvisorChatMessage message={message} />
              </li>
            ))}
            {pendingMessage ? (
              <li className="space-y-8 sm:space-y-10">
                <UserMessage content={pendingMessage} pending />
                <ChatResponsePending />
              </li>
            ) : null}
          </ol>
        ) : pendingMessage ? (
          <div className="space-y-8 sm:space-y-10">
            <UserMessage content={pendingMessage} pending />
            <ChatResponsePending />
          </div>
        ) : null}
        <div ref={conversationEndRef} aria-hidden="true" />
      </div>

      <AdvisorChatComposer
        ref={textareaRef}
        value={draft}
        canSend={canSend}
        sending={chatMutation.isPending}
        notice={sendNotice}
        onChange={value => {
          setDraft(value)
          setSendNotice(null)
        }}
        onSend={sendMessage}
      />
    </ChatShell>
  )
}

function ChatShell({ children }: { children: ReactNode }) {
  return (
    <section className="mx-auto flex h-[calc(100dvh-9.75rem)] min-h-[32rem] w-full max-w-[780px] flex-col overflow-hidden lg:h-[calc(100dvh-9.25rem)]">
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border/55 px-1 sm:px-4">
        <span className="grid size-7 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary">
          <CommentPixelIcon size={13} aria-hidden="true" />
        </span>
        <h1 className="text-[15px] font-semibold tracking-tight text-foreground">Chat</h1>
      </header>
      {children}
    </section>
  )
}

function ChatEmptyState({
  title,
  description,
  suggestions,
  onSelectSuggestion,
}: {
  title: string
  description?: string
  suggestions?: readonly string[]
  onSelectSuggestion?: (suggestion: string) => void
}) {
  return (
    <div className="flex min-h-full flex-col justify-end pb-6 sm:pb-10">
      <div className="mx-auto w-full max-w-[520px]">
        <h2 className="text-center text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="mx-auto mt-2 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {suggestions?.length && onSelectSuggestion ? (
          <fieldset className="mt-6 grid gap-2">
            <legend className="sr-only">Questions suggérées</legend>
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
                className="min-h-11 rounded-lg border border-border/65 bg-card/35 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
              >
                {suggestion}
              </button>
            ))}
          </fieldset>
        ) : null}
      </div>
    </div>
  )
}

function ChatLoadingState() {
  return (
    <output className="flex min-h-full items-center" aria-live="polite">
      <div className="w-full max-w-[560px] space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Réponse en cours
        </p>
        <div className="space-y-3" aria-hidden="true">
          <div className="h-3 w-2/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
          <div className="h-3 w-4/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
          <div className="h-3 w-3/5 animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none" />
        </div>
      </div>
    </output>
  )
}
