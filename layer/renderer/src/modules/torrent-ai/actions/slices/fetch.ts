import { getAiIntegrationEnabled } from '~/lib/ai-integration'
import { ipcServices } from '~/lib/ipc-client'
import { queryClient } from '~/lib/query/query-client'
import { QueryKeys } from '~/lib/query/query-keys'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import type { TorrentFile } from '~/types'

import { ensureEntry } from '../../store'
import type {
  EnsureMetadataOptions,
  TorrentAiActionResult,
  TorrentAiEnrichmentResult,
  TorrentAiEntry,
} from '../../types'
import type { TorrentAiActionContext } from '../context'

const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON
const MAX_FILE_TREE_COUNT = 500
export const createFetchSlice = (context: TorrentAiActionContext) => {
  const updateEntry = (
    hash: string,
    updater: (entry: TorrentAiEntry) => void,
  ) => {
    context.setState((draft) => {
      const entry = draft.entries[hash]
      if (!entry) return
      updater(entry)
    })
  }

  const ensureMetadata = async (
    options: EnsureMetadataOptions,
  ): Promise<TorrentAiActionResult<TorrentAiEnrichmentResult>> => {
    const trimmedName = options.rawName.trim()
    if (!trimmedName) {
      return { ok: false, error: 'ai.invalidRawName' }
    }

    // Respect user toggle to disable AI integration entirely
    if (!getAiIntegrationEnabled()) {
      return { ok: false, error: 'ai.disabled' }
    }

    // Language is tracked in store via i18n.language (set later when updating entry)
    const entry = ensureEntry(options.hash, trimmedName)

    if (!options.force && entry.status === 'ready' && entry.metadata) {
      return {
        ok: true,
        data: {
          ok: true,
          metadata: entry.metadata,
        },
      }
    }

    const torrentAiService = ipcServices?.torrentAi

    if (!isElectron || !torrentAiService) {
      updateEntry(options.hash, (draft) => {
        draft.status = 'error'
        draft.error = 'ai.notSupported'
        draft.metadata = null
        draft.updatedAt = Date.now()
      })
      return { ok: false, error: 'ai.notSupported' }
    }

    if (!options.force && entry.status === 'loading') {
      return { ok: false, error: 'ai.inProgress', transient: true }
    }

    updateEntry(options.hash, (draft) => {
      draft.status = 'loading'
      draft.error = null
      // Keep current UI language captured when entry was ensured
      draft.rawName = trimmedName
      draft.requestedAt = Date.now()
    })

    try {
      let compactFileList: Array<{ path: string; size?: number }> | undefined
      try {
        const filesKey = QueryKeys.torrentDetails.files(options.hash)
        let files = queryClient.getQueryData(filesKey) as
          | TorrentFile[]
          | undefined

        if (!files) {
          files = await queryClient.fetchQuery({
            queryKey: filesKey,
            queryFn: () =>
              QBittorrentClient.shared.requestTorrentFiles(options.hash),
          })
        }

        if (files)
          compactFileList = files.slice(0, MAX_FILE_TREE_COUNT).map((f) => ({
            path: f.name,
            size: f.size,
          }))
      } catch {
        // Ignore cache access errors
      }

      const payload: {
        rawName: string
        hash?: string
        forceRefresh?: boolean
        fileList?: Array<{ path: string; size?: number }>
      } = {
        rawName: trimmedName,
        hash: options.hash,
        forceRefresh: options.force,
        fileList: compactFileList,
      }

      const result = await torrentAiService.analyzeName(payload)

      if (result.ok && result.metadata) {
        const { metadata } = result
        updateEntry(options.hash, (draft) => {
          draft.status = 'ready'
          draft.metadata = metadata
          draft.error = null
          draft.updatedAt = Date.now()
          draft.retries = 0
        })
        return { ok: true, data: result }
      }

      const fallbackError = 'ai.providers.requestFailed'

      updateEntry(options.hash, (draft) => {
        draft.status = 'error'
        draft.metadata = null
        draft.error = result.error ?? fallbackError
        draft.updatedAt = Date.now()
        draft.retries += 1
      })

      return {
        ok: false,
        error: result.error ?? fallbackError,
        transient: result.transient,
      }
    } catch (error) {
      console.error('[torrent-ai] renderer fetch failed', {
        hash: options.hash,
        error,
      })
      updateEntry(options.hash, (draft) => {
        draft.status = 'error'
        draft.metadata = null
        draft.error = 'ai.providers.requestFailed'
        draft.updatedAt = Date.now()
        draft.retries += 1
      })
      return { ok: false, error: 'ai.providers.requestFailed', transient: true }
    }
  }

  const invalidateEntry = (hash: string) => {
    updateEntry(hash, (draft) => {
      draft.status = 'idle'
      draft.metadata = null
      draft.error = null
    })
  }

  return {
    ensureMetadata,
    invalidateEntry,
  }
}
