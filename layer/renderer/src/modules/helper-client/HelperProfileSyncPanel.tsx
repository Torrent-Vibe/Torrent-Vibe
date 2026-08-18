import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Checkbox } from '~/components/ui/checkbox'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Modal } from '~/components/ui/modal/ModalManager'
import type { ModalComponent } from '~/components/ui/modal/types'
import { Prompt } from '~/components/ui/prompts/Prompt'

import { getHelperProfile, patchHelperProfile } from './api'
import { getHelperBinding } from './bindings'
import {
  applyDesktopProfileRecords,
  collectDesktopProfileRecords,
  HELPER_PROFILE_GROUPS,
  type HelperProfileGroupId,
  profileGroupForKey,
  profileRecordsInGroups,
} from './profile-sync'
import type { HelperProfileRecord, HelperProfileSnapshot } from './types'

const countByGroup = (records: HelperProfileRecord[]) => {
  const counts = new Map<HelperProfileGroupId, number>()
  for (const record of records) {
    const group = profileGroupForKey(record.key)
    if (group) {
      counts.set(group, (counts.get(group) ?? 0) + 1)
    }
  }
  return counts
}

const HelperProfileSyncContent = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation('app')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localRecords, setLocalRecords] = useState<HelperProfileRecord[]>([])
  const [remote, setRemote] = useState<HelperProfileSnapshot | null>(null)
  const [selected, setSelected] = useState<Set<HelperProfileGroupId>>(
    () => new Set(HELPER_PROFILE_GROUPS.map((group) => group.id)),
  )

  const refresh = useCallback(async () => {
    const binding = getHelperBinding(serverId)
    if (!binding) return
    setError(null)
    try {
      const [local, profile] = await Promise.all([
        collectDesktopProfileRecords(),
        getHelperProfile(binding.url, binding.token),
      ])
      setLocalRecords(local)
      setRemote(profile)
    } catch (cause) {
      const status = (cause as { status?: number } | null)?.status
      setError(status === 404 ? 'unsupported' : 'failed')
    }
  }, [serverId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const localCounts = useMemo(() => countByGroup(localRecords), [localRecords])
  const remoteCounts = useMemo(
    () => countByGroup(remote?.records ?? []),
    [remote?.records],
  )

  const upload = async () => {
    const binding = getHelperBinding(serverId)
    if (!binding || !remote) return
    const records = profileRecordsInGroups(localRecords, selected)
    if (records.length === 0) return
    setBusy(true)
    try {
      const mutations = records.map((record) => ({
        operation: 'set' as const,
        key: record.key,
        value: record.value,
        secret: record.secret,
      }))
      let latest = remote
      try {
        latest = await patchHelperProfile(
          binding.url,
          binding.token,
          latest.revision,
          mutations,
        )
      } catch (cause) {
        if ((cause as { status?: number } | null)?.status !== 409) throw cause
        latest = await getHelperProfile(binding.url, binding.token)
        latest = await patchHelperProfile(
          binding.url,
          binding.token,
          latest.revision,
          mutations,
        )
      }
      setRemote(latest)
      toast.success(
        t('servers.helper.profileUploadComplete', { count: records.length }),
      )
    } catch {
      toast.error(t('servers.helper.profileSyncFailed'))
    } finally {
      setBusy(false)
    }
  }

  const pull = async () => {
    if (!remote) return
    const records = profileRecordsInGroups(remote.records, selected)
    if (records.length === 0) return
    setBusy(true)
    try {
      const applied = await applyDesktopProfileRecords(records)
      await refresh()
      toast.success(t('servers.helper.profilePullComplete', { count: applied }))
    } catch {
      toast.error(t('servers.helper.profileSyncFailed'))
    } finally {
      setBusy(false)
    }
  }

  const confirm = (direction: 'pull' | 'upload') => {
    Prompt.prompt({
      title: t(
        direction === 'upload'
          ? 'servers.helper.profileUploadConfirmTitle'
          : 'servers.helper.profilePullConfirmTitle',
      ),
      description: t(
        direction === 'upload'
          ? 'servers.helper.profileUploadConfirmDescription'
          : 'servers.helper.profilePullConfirmDescription',
      ),
      onCancelText: t('common.cancel'),
      onConfirmText: t(
        direction === 'upload'
          ? 'servers.helper.profileUpload'
          : 'servers.helper.profilePull',
      ),
      onConfirm: direction === 'upload' ? upload : pull,
    })
  }

  if (error) {
    return (
      <div className="rounded-md border border-border/60 p-3 text-xs text-text-secondary">
        {t(
          error === 'unsupported'
            ? 'servers.helper.profileUnsupported'
            : 'servers.helper.profileLoadFailed',
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="helper-profile-sync">
      <div className="divide-y divide-border/50 rounded-md border border-border/60">
        {HELPER_PROFILE_GROUPS.map((group) => (
          <label
            className="flex cursor-pointer items-center gap-3 px-3 py-2"
            key={group.id}
          >
            <Checkbox
              checked={selected.has(group.id)}
              size="sm"
              onCheckedChange={(checked) => {
                setSelected((current) => {
                  const next = new Set(current)
                  if (checked) next.add(group.id)
                  else next.delete(group.id)
                  return next
                })
              }}
            />
            <span className="min-w-0 flex-1 text-xs font-medium text-text">
              {t(`servers.helper.profileGroup.${group.id}`)}
            </span>
            <span className="text-[11px] text-text-tertiary">
              {t('servers.helper.profileCounts', {
                local: localCounts.get(group.id) ?? 0,
                remote: remoteCounts.get(group.id) ?? 0,
              })}
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4">
        <Button
          data-testid="helper-profile-upload"
          disabled={busy || !remote || selected.size === 0}
          size="sm"
          variant="secondary"
          onClick={() => confirm('upload')}
        >
          {t('servers.helper.profileUpload')}
        </Button>
        <Button
          data-testid="helper-profile-pull"
          disabled={busy || !remote || selected.size === 0}
          size="sm"
          onClick={() => confirm('pull')}
        >
          {t('servers.helper.profilePull')}
        </Button>
      </div>
    </div>
  )
}

const HelperProfileSyncModal: ModalComponent<{ serverId: string }> = ({
  serverId,
}) => {
  const { t } = useTranslation('app')
  return (
    <div>
      <DialogHeader className="mb-4">
        <DialogTitle>{t('servers.helper.profileTitle')}</DialogTitle>
        <DialogDescription className="text-text-secondary">
          {t('servers.helper.profileDescription')}
        </DialogDescription>
      </DialogHeader>
      <HelperProfileSyncContent serverId={serverId} />
    </div>
  )
}

HelperProfileSyncModal.contentClassName =
  'w-[560px] max-w-[calc(100vw-2rem)] p-5'

export const HelperProfileSyncPanel = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation('app')
  return (
    <Button
      className="h-auto w-full justify-between gap-3 border border-border/60 px-3 py-2.5 text-left"
      data-testid="helper-profile-sync-open"
      variant="ghost"
      onClick={() => {
        Modal.present(HelperProfileSyncModal, { serverId })
      }}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">
          {t('servers.helper.profileTitle')}
        </span>
        <span className="block truncate text-xs font-normal text-text-secondary">
          {t('servers.helper.profileDescription')}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
        {t('servers.helper.profileOpen')}
        <i className="i-mingcute-right-line text-sm" />
      </span>
    </Button>
  )
}
