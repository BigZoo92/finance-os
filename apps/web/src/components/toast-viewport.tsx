import { cva } from '@finance-os/styled-system/css'
import { styled } from '@finance-os/styled-system/jsx'
import { Button } from '@finance-os/ui/components'
import { TimesPixelIcon } from '@finance-os/ui/icons/pixel/times'
import { useStore } from '@tanstack/react-store'
import { dismissToast, toastStore } from '@/lib/toast-store'

const toastCard = cva({
  base: {
    pointerEvents: 'auto',
    rounded: 'md',
    borderWidth: '1px',
    bg: 'card',
    p: '3',
    shadow: 'sm',
  },
  variants: {
    tone: {
      success: { borderColor: 'positive/60' },
      error: { borderColor: 'destructive/60' },
      info: { borderColor: 'border' },
    },
  },
})

export function ToastViewport() {
  const toasts = useStore(toastStore)

  if (toasts.length === 0) {
    return null
  }

  return (
    <styled.div
      aria-live="polite"
      pointerEvents="none"
      position="fixed"
      bottom="24"
      right="4"
      zIndex="toast"
      display="flex"
      w="full"
      maxW="sm"
      flexDirection="column"
      gap="2"
      lg={{ bottom: '4' }}
    >
      {toasts.map(toast => (
        <div key={toast.id} className={toastCard({ tone: toast.tone })}>
          <styled.div display="flex" alignItems="flex-start" justifyContent="space-between" gap="2">
            <div>
              <styled.p textStyle="sm" fontWeight="medium">
                {toast.title}
              </styled.p>
              {toast.description ? (
                <styled.p mt="1" textStyle="xs" color="muted.foreground">
                  {toast.description}
                </styled.p>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              h="6"
              px="2"
              onClick={() => dismissToast(toast.id)}
            >
              <TimesPixelIcon size={12} />
            </Button>
          </styled.div>
        </div>
      ))}
    </styled.div>
  )
}
