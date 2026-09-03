/**
 * ManualImportDialog — Admin-only secondary tool, out of the gallery.
 *
 * Keeps the manual ingestion capability (one signal per line, structured
 * lists accepted) without exposing any JSON tooling to normal users.
 */
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

const parseManualItems = (raw: string): ManualItem[] => {
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
      // Not structured input: fall through to one signal per line.
    }
  }
  return trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => ({ text: line }))
}

/** Mounted only while open, so the textarea starts empty on every opening. */
export function ManualImportDialog({ open, onOpenChange, onImported }: ManualImportDialogProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => postManualImport(parseManualItems(text)),
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

  const items = parseManualItems(text)

  return (
    <Dialog open={open} onOpenChange={next => !mutation.isPending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import manuel</DialogTitle>
          <DialogDescription>Un signal par ligne.</DialogDescription>
        </DialogHeader>
        <label
          className="space-y-1.5 text-xs font-medium text-foreground"
          htmlFor="manual-import-text"
        >
          <span className="sr-only">Signaux à importer</span>
          <textarea
            id="manual-import-text"
            rows={6}
            value={text}
            onChange={event => setText(event.target.value)}
            className="w-full resize-y rounded-control border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-negative">
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
              ? 'Import'
              : `Importer${items.length > 0 ? ` (${items.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
