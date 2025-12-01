import { toast } from 'sonner'

import type { PathMappingEntry } from '~/atoms/settings/path-mappings'
import { getPathMappings } from '~/atoms/settings/path-mappings'
import { Prompt } from '~/components/ui/prompts/Prompt'
import { getI18n } from '~/i18n'
import { ipcServices } from '~/lib/ipc-client'
import { buildPathCandidates } from '~/lib/path-mapping'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'
import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'
import type { TorrentInfo } from '~/types/torrent'

const getActiveServerId = (): string | null => {
  try {
    return useMultiServerStore.getState().activeServerId ?? null
  } catch {
    return null
  }
}

const showFailure = (reason?: string) => {
  const { t } = getI18n()
  if (reason) {
    toast.error(t('messages.openPathFailedWithReason', { message: reason }))
  } else {
    toast.error(t('messages.openPathFailed'))
  }
}

const sanitizePath = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed || null
}

const joinRemotePath = (base: string, relative: string) => {
  const normalizedBase = base.replaceAll(/[/\\]+$/g, '')
  const sanitizedRelative = relative.replace(/^[/\\]+/, '')
  if (!sanitizedRelative) return normalizedBase

  if (
    normalizedBase.startsWith('\\\\') ||
    /^[A-Z]:/i.test(normalizedBase) ||
    (normalizedBase.includes('\\') && !normalizedBase.includes('/'))
  ) {
    const basePath = normalizedBase.endsWith('\\')
      ? normalizedBase
      : `${normalizedBase}\\`
    return `${basePath}${sanitizedRelative.replaceAll('/', '\\')}`
  }

  const basePath = normalizedBase ? `${normalizedBase}/` : ''
  return `${basePath}${sanitizedRelative.replaceAll('\\', '/')}`
}

const runPathAction = async (
  candidates: string[],
  action: 'open' | 'reveal' | 'open-folder',
) => {
  if (!ipcServices?.fileSystem) {
    showFailure()
    return false
  }

  try {
    const response = await ipcServices.fileSystem.handlePathAction({
      candidates,
      action,
    })

    if (!response?.ok) {
      showFailure(response?.message)
      return false
    }
    return true
  } catch (error) {
    showFailure(error instanceof Error ? error.message : String(error))
    return false
  }
}

const showPathMappingPrompt = async (
  remotePath: string,
  reason: 'no-mapping' | 'no-match',
) => {
  const { t } = getI18n()
  await Prompt.prompt({
    title: t('prompts.pathMappingRequired.title'),
    description:
      reason === 'no-mapping'
        ? t('prompts.pathMappingRequired.descriptionNoMappings', {
            path: remotePath,
          })
        : t('prompts.pathMappingRequired.descriptionNoMatch', {
            path: remotePath,
          }),
    onConfirmText: t('prompts.pathMappingRequired.confirm'),
    onCancelText: t('common.cancel'),
    onConfirm: () => {
      presentSettingsModal({ tab: 'servers' })
    },
  })
}

const ensurePathMapping = async (
  remotePath: string,
  mapping: PathMappingEntry | null,
) => {
  if (!ELECTRON) return true

  const enabledMappings = getPathMappings().filter((entry) => entry.enabled)
  if (mapping) return true

  if (enabledMappings.length === 0) {
    await showPathMappingPrompt(remotePath, 'no-mapping')
    return false
  }

  await showPathMappingPrompt(remotePath, 'no-match')
  return false
}

const resolveTorrentBasePath = (
  torrent: TorrentInfo,
  preference: 'content' | 'save' | 'auto' = 'auto',
) => {
  const content = sanitizePath(torrent.content_path)
  const save = sanitizePath(torrent.save_path)

  if (preference === 'content') return content || save
  if (preference === 'save') return save || content

  return content || save
}

const buildTorrentRelativePath = (
  torrent: TorrentInfo,
  relativePath?: string,
) => {
  const sanitizedRelative = relativePath?.trim() ?? ''
  if (!sanitizedRelative) {
    return resolveTorrentBasePath(torrent, 'content')
  }

  const baseContent = resolveTorrentBasePath(torrent, 'content')
  const baseSave = resolveTorrentBasePath(torrent, 'save')
  const normalizedRelative = sanitizedRelative.replaceAll('\\', '/')

  if (baseContent) {
    const normalizedContent = baseContent.replaceAll(/[/\\]+$/g, '')
    const segments = normalizedContent.split(/[/\\]/).filter(Boolean)
    const rootName = segments.at(-1)

    if (rootName) {
      if (normalizedRelative === rootName) {
        return normalizedContent
      }

      if (normalizedRelative.startsWith(`${rootName}/`)) {
        const rest = normalizedRelative
          .slice(rootName.length)
          .replace(/^[/\\]+/, '')
        return joinRemotePath(normalizedContent, rest)
      }
    }
  }

  if (baseSave) {
    return joinRemotePath(baseSave, normalizedRelative)
  }

  if (baseContent) {
    return joinRemotePath(baseContent, normalizedRelative)
  }

  return normalizedRelative
}

const runRemotePathAction = async (
  remotePath: string | null | undefined,
  action: 'open' | 'reveal' | 'open-folder',
) => {
  const trimmed = remotePath?.trim()
  if (!trimmed) {
    showFailure()
    return false
  }

  const serverId = getActiveServerId()
  const { candidates, mapping } = buildPathCandidates(trimmed, { serverId })

  const mappingReady = await ensurePathMapping(trimmed, mapping)
  if (!mappingReady) {
    return false
  }

  if (candidates.length === 0) {
    showFailure()
    return false
  }

  return await runPathAction(candidates, action)
}

export const openTorrentContent = async (torrent: TorrentInfo) => {
  const sourcePath = resolveTorrentBasePath(torrent, 'content')
  return await runRemotePathAction(sourcePath, 'open')
}

export const revealTorrentContent = async (torrent: TorrentInfo) => {
  const sourcePath = resolveTorrentBasePath(torrent, 'content')
  return await runRemotePathAction(sourcePath, 'reveal')
}

export const openTorrentSaveLocation = async (torrent: TorrentInfo) => {
  const targetPath = resolveTorrentBasePath(torrent, 'save')
  return await runRemotePathAction(targetPath, 'open-folder')
}

export const runTorrentRelativePathAction = async (
  torrent: TorrentInfo,
  relativePath: string,
  action: 'open' | 'reveal' | 'open-folder',
) => {
  const remotePath = buildTorrentRelativePath(torrent, relativePath)
  return await runRemotePathAction(remotePath, action)
}
