import { css } from '@finance-os/styled-system/css'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@finance-os/ui/components'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { postManualImport } from '@/features/signals-api'
import { pushToast } from '@/lib/toast-store'

type ManualImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type ManualItem = { text: string; author?: string; url?: string }

// Tailwind's `space-y-1.5` put the margin on every child but the last: the
// visually hidden caption is absolutely positioned, so the textarea never moved.
const importField = css({
  textStyle: 'xs',
  fontWeight: 'medium',
  color: 'foreground',
  '& > :not(:last-child)': { marginBlockEnd: '1.5' },
})

const visuallyHidden = css({ srOnly: true })

const importTextarea = css({
  w: 'full',
  resize: 'vertical',
  rounded: 'control',
  borderWidth: '1px',
  borderColor: 'input',
  bg: 'transparent',
  px: '3',
  py: '2',
  textStyle: 'sm',
  color: 'foreground',
  outlineStyle: 'none',
  transitionProperty: 'colors',
  transitionDuration: '150ms',
  transitionTimingFunction: 'default',
  _placeholder: { color: 'muted.foreground' },
  _focusVisible: { boxShadow: '0 0 0 2px color-mix(in srgb, {colors.ring} 70%, transparent)' },
})

const importError = css({ textStyle: 'sm', color: 'negative' })

export const parseManualSocialItems = (raw: string): ManualItem[] => {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      return list.flatMap(entry =>
        entry && typeof entry === 'object' && typeof (entry as ManualItem).text === 'string'
          ? [entry as ManualItem]
          : []
      )
    } catch {
      // Plain text remains a supported input.
    }
  }
  return trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ text: line }))
}

export function ManualSocialImportDialog({
  open,
  onOpenChange,
  onImported,
}: ManualImportDialogProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: () => postManualImport(parseManualSocialItems(text)),
    onSuccess: data => {
      if (!data.ok) {
        setError('Import impossible pour le moment')
        return
      }
      const count = data.insertedCount ?? 0
      pushToast({
        title:
          count > 0
            ? `${count} ${count > 1 ? 'signaux importés' : 'signal importé'}`
            : 'Aucun nouveau signal',
        tone: 'success',
      })
      onImported()
      onOpenChange(false)
    },
    onError: () => setError('Import impossible pour le moment'),
  })
  const items = parseManualSocialItems(text)

  return (
    <Dialog open={open} onOpenChange={next => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import manuel Social</DialogTitle>
          <DialogDescription>
            Ajoutez un signal par ligne ou une liste structurée.
          </DialogDescription>
        </DialogHeader>
        <label className={importField} htmlFor="manual-social-import-text">
          <span className={visuallyHidden}>Signaux à importer</span>
          <textarea
            id="manual-social-import-text"
            rows={6}
            value={text}
            onChange={event => setText(event.target.value)}
            className={importTextarea}
          />
        </label>
        {error ? (
          <p role="alert" className={importError}>
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={mutation.isPending}>
              Annuler
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={items.length === 0 || mutation.isPending}
            onClick={() => {
              setError(null)
              mutation.mutate()
            }}
          >
            {mutation.isPending
              ? 'Import en cours'
              : `Importer${items.length > 0 ? ` (${items.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
