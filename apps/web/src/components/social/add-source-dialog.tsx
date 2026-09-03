/**
 * AddSourceDialog — Admin-only creation of a followed source.
 *
 * Preserves the lookup then create chain (X profile hydration, the
 * "already present" branch) behind human copy: no HTTP codes, no provider
 * payloads, no follower metrics.
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Status,
} from '@finance-os/ui/components'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { createSignalSource, type SignalSourceGroup } from '@/features/signals-api'
import {
  avatarTintFor,
  describeCreateFailure,
  describeLookupOutcome,
  GROUP_LABEL,
  PLATFORM_LABEL,
  PROVIDER_FOR_PLATFORM,
  type SocialPlatform,
  toInitials,
} from '@/features/social/view-model'
import { lookupXHandle } from '@/features/x-twitter-api'
import { normalizeXHandleForUi } from '@/features/x-twitter-social-dedupe'
import { pushToast } from '@/lib/toast-store'
import { SourceAvatar } from './source-card'

type AddSourceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultGroup: SignalSourceGroup
  onCreated: () => void
}

type Platform = Exclude<SocialPlatform, 'other'>
const PLATFORMS: Platform[] = ['x', 'bluesky', 'manual']
const GROUPS: SignalSourceGroup[] = ['finance', 'ai_tech']

/**
 * Mounted only while open (the parent renders it conditionally), so form
 * state starts fresh on every opening without synchronization effects.
 */
export function AddSourceDialog({
  open,
  onOpenChange,
  defaultGroup,
  onCreated,
}: AddSourceDialogProps) {
  const [platform, setPlatform] = useState<Platform>('x')
  const [group, setGroup] = useState<SignalSourceGroup>(defaultGroup)
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)

  const lookupMutation = useMutation({
    mutationFn: () => lookupXHandle({ handle: handle.trim(), persist: false, forceRefresh: false }),
    onSuccess: data => {
      if (data.ok && data.profile && displayName.trim().length === 0) {
        setDisplayName(data.profile.name)
      }
    },
  })
  const lookup = lookupMutation.data
  const profile = platform === 'x' && lookup?.ok ? (lookup.profile ?? null) : null

  const createMutation = useMutation({
    mutationFn: () =>
      createSignalSource({
        provider: PROVIDER_FOR_PLATFORM[platform],
        handle: handle.trim(),
        displayName: displayName.trim(),
        group,
        tags: tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
        ...(profile
          ? {
              externalId: profile.id,
              profileImageUrl: profile.profileImageUrl,
              profileMetadata: {
                username: profile.username,
                name: profile.name,
                description: profile.description,
                profileBannerUrl: profile.profileBannerUrl,
                verified: profile.verified,
                verifiedType: profile.verifiedType,
                protected: profile.protected,
                publicMetrics: profile.publicMetrics,
                createdAt: profile.createdAt,
              },
            }
          : {}),
      }),
    onSuccess: data => {
      if (!data.ok) {
        setError(describeCreateFailure(data.code))
        return
      }
      pushToast({
        title:
          data.action === 'updated_existing'
            ? 'Source déjà présente, profil mis à jour'
            : 'Source ajoutée',
        tone: 'success',
      })
      onCreated()
      onOpenChange(false)
    },
    onError: () => setError('Ajout impossible pour le moment'),
  })

  const canSubmit =
    handle.trim().length > 0 && displayName.trim().length > 0 && !createMutation.isPending

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setError(null)
    createMutation.mutate()
  }

  const previewHandle = profile ? normalizeXHandleForUi(profile.username) : ''

  return (
    <Dialog open={open} onOpenChange={next => !createMutation.isPending && onOpenChange(next)}>
      <DialogContent className="max-sm:bottom-0 max-sm:left-0 max-sm:top-auto max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Ajouter une source</DialogTitle>
            <DialogDescription>Le compte rejoint la liste des sources suivies.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <label
              className="space-y-1.5 text-xs font-medium text-foreground"
              htmlFor="source-platform"
            >
              <span>Source</span>
              <Select
                value={platform}
                onValueChange={value => {
                  setPlatform(value as Platform)
                  lookupMutation.reset()
                }}
              >
                <SelectTrigger id="source-platform" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(option => (
                    <SelectItem key={option} value={option}>
                      {PLATFORM_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label
              className="space-y-1.5 text-xs font-medium text-foreground"
              htmlFor="source-group"
            >
              <span>Groupe</span>
              <Select value={group} onValueChange={value => setGroup(value as SignalSourceGroup)}>
                <SelectTrigger id="source-group" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUPS.map(option => (
                    <SelectItem key={option} value={option}>
                      {GROUP_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label
              className="space-y-1.5 text-xs font-medium text-foreground"
              htmlFor="source-handle"
            >
              <span>Identifiant</span>
              <Input
                id="source-handle"
                value={handle}
                onChange={event => setHandle(event.target.value)}
                placeholder={platform === 'x' ? '@compte ou lien x.com' : 'Identifiant'}
                autoComplete="off"
              />
            </label>
            <label
              className="space-y-1.5 text-xs font-medium text-foreground"
              htmlFor="source-name"
            >
              <span>Nom affiché</span>
              <Input
                id="source-name"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="Nom visible"
                autoComplete="off"
              />
            </label>
            <label
              className="space-y-1.5 text-xs font-medium text-foreground sm:col-span-2"
              htmlFor="source-tags"
            >
              <span>Sujets (séparés par des virgules)</span>
              <Input
                id="source-tags"
                value={tags}
                onChange={event => setTags(event.target.value)}
                placeholder="macro, taux, ETF"
                autoComplete="off"
              />
            </label>
          </div>

          {platform === 'x' ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={handle.trim().length === 0 || lookupMutation.isPending}
                  onClick={() => lookupMutation.mutate()}
                  data-testid="x-account-verify"
                >
                  {lookupMutation.isPending ? 'Vérification' : 'Vérifier sur X'}
                </Button>
                {lookupMutation.isError ? (
                  <Status tone="attention" label="Vérification indisponible pour le moment" />
                ) : lookup ? (
                  <Status
                    tone={lookup.ok ? 'positive' : 'attention'}
                    label={describeLookupOutcome(lookup.verificationStatus, lookup.ok)}
                  />
                ) : null}
              </div>
              {profile ? (
                <div className="flex items-start gap-3 rounded-control border border-positive/30 bg-positive/5 p-3">
                  <SourceAvatar
                    source={{
                      avatarUrl: profile.profileImageUrl,
                      initials: toInitials(profile.name, previewHandle),
                      avatarTint: avatarTintFor(previewHandle),
                      name: profile.name,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold text-foreground">{profile.name}</p>
                    <p className="font-mono text-[11px] text-foreground/55">@{previewHandle}</p>
                    {profile.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/65">
                        {profile.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={createMutation.isPending}>
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? 'Ajout' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
