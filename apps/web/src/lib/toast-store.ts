import { Store } from '@tanstack/store'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastMessage = {
  id: string
  title: string
  description?: string
  tone: ToastTone
}

const TOAST_TTL_MS = 5000

export const toastStore = new Store<ToastMessage[]>([])

const removeToast = (id: string) => {
  toastStore.setState(current => current.filter(toast => toast.id !== id))
}

export const pushToast = (input: Omit<ToastMessage, 'id'>) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  toastStore.setState(current => [
    ...current,
    {
      id,
      ...input,
    },
  ])

  setTimeout(() => {
    removeToast(id)
  }, TOAST_TTL_MS)
}

export const dismissToast = (id: string) => {
  removeToast(id)
}
