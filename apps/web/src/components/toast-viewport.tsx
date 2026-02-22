import { Button } from '@finance-os/ui/components'
import { useStore } from '@tanstack/react-store'
import { dismissToast, toastStore, type ToastTone } from '@/lib/toast-store'

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'border-emerald-500/60',
  error: 'border-destructive/60',
  info: 'border-border',
}

export function ToastViewport() {
  const toasts = useStore(toastStore)

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-md border bg-card p-3 shadow-sm ${TONE_CLASS[toast.tone]}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-xs text-muted-foreground">{toast.description}</p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              onClick={() => dismissToast(toast.id)}
            >
              x
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
