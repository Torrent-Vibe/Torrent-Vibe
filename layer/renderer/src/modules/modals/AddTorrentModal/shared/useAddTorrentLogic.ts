import type { AddTorrentOptions } from '@torrent-vibe/qb-client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useEventCallback } from 'usehooks-ts'

import { useModal } from '~/components/ui/modal/hooks'
import { getI18n } from '~/i18n'
import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'

import { useAddTorrentForm } from '../hooks/useAddTorrentForm'
import type { TorrentContentPreviewState } from '../types'
import { createAddTorrentOptions } from './createAddTorrentOptions'
import { getMagnetLinks } from './get-magnet-links'
import { parseTorrentFile } from './parse-torrent-file'
import type { AddTorrentModalProps } from './types'
import { useEnsureTorrentCategories } from './useEnsureTorrentCategories'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type PreviewMeta =
  | {
      type: 'magnet'
      hash: string
      magnetUri: string
      existed: boolean
      finalized?: boolean
    }
  | { type: 'file'; infoHash: string; fileName: string; finalized?: boolean }

export const useAddTorrentLogic = ({
  initialFiles,
  initialMagnetLinks,
}: AddTorrentModalProps) => {
  const { dismiss } = useModal()
  const {
    formData,
    setFormData,
    resetFormData,
    isFormValid: baseIsFormValid,
    categories,
  } = useAddTorrentForm(initialFiles)

  const [isLoading, setIsLoading] = useState(false)
  const [previewState, setPreviewState] = useState<TorrentContentPreviewState>(
    () => ({ status: 'idle', files: [] }),
  )
  const [selectedFileIndices, setSelectedFileIndices] = useState<Set<number>>(
    () => new Set(),
  )

  const previewMetaRef = useRef<PreviewMeta | null>(null)
  const previewRequestIdRef = useRef(0)

  useEnsureTorrentCategories(categories)

  // Prefill magnet links if provided
  useEffect(() => {
    if (!initialMagnetLinks) return
    setFormData((prev) => ({
      ...prev,
      method: 'magnet' as const,
      magnetLinks: initialMagnetLinks,
    }))
  }, [initialMagnetLinks, setFormData])

  const cleanupPreviewMagnet = useEventCallback(async () => {
    const meta = previewMetaRef.current
    if (
      meta?.type === 'magnet' &&
      !meta.existed &&
      !meta.finalized &&
      meta.hash
    ) {
      try {
        await QBittorrentClient.shared.removeTorrent(meta.hash, false)
      } catch (error) {
        console.warn('Failed to clean up preview magnet:', error)
      }
    }
  })

  const clearPreview = useEventCallback(async () => {
    await cleanupPreviewMagnet()
    previewMetaRef.current = null
    setPreviewState({ status: 'idle', files: [] })
    setSelectedFileIndices(new Set())
  })

  const loadFilePreview = useEventCallback(async (file?: File) => {
    if (!file) {
      await clearPreview()
      return
    }

    const requestId = ++previewRequestIdRef.current
    setPreviewState({ status: 'loading', source: 'file', files: [] })

    try {
      const parsed = await parseTorrentFile(file)
      if (previewRequestIdRef.current !== requestId) return

      previewMetaRef.current = {
        type: 'file',
        infoHash: parsed.infoHash,
        fileName: file.name,
      }

      setPreviewState({
        status: 'ready',
        source: 'file',
        name: parsed.name,
        hash: parsed.infoHash,
        totalSize: parsed.totalSize,
        files: parsed.files,
      })
      setSelectedFileIndices(new Set(parsed.files.map((f) => f.index)))
    } catch (error) {
      console.error('Failed to load file preview:', error)
      if (previewRequestIdRef.current !== requestId) return

      previewMetaRef.current = null
      setPreviewState({
        status: 'error',
        source: 'file',
        files: [],
        error:
          error instanceof Error
            ? error.message
            : String(error ?? 'Unknown error'),
      })
      setSelectedFileIndices(new Set())
    }
  })

  const refreshFilePreview = useEventCallback(async () => {
    const primary = formData.files[0]
    if (primary) {
      await loadFilePreview(primary)
    } else {
      await clearPreview()
    }
  })

  const handleFilesSelected = useEventCallback(async (files: File[]) => {
    const torrentFiles = files.filter((file) => file.name.endsWith('.torrent'))
    if (torrentFiles.length === 0) return

    await clearPreview()

    let merged: File[] = []
    setFormData((prev) => {
      merged = [...prev.files, ...torrentFiles]
      return {
        ...prev,
        files: merged,
        method: 'file',
      }
    })

    if (merged.length > 0) {
      await loadFilePreview(merged[0])
    } else {
      await clearPreview()
    }
  })

  const removeFile = useEventCallback(async (index: number) => {
    let remaining: File[] = []
    setFormData((prev) => {
      remaining = prev.files.filter((_, i) => i !== index)
      return {
        ...prev,
        files: remaining,
      }
    })

    if (remaining.length > 0) {
      await loadFilePreview(remaining[0])
    } else {
      await clearPreview()
    }
  })

  const loadMagnetPreview = useEventCallback(async () => {
    const magnets = getMagnetLinks(formData.magnetLinks)
    if (magnets.length === 0) {
      setPreviewState({
        status: 'error',
        source: 'magnet',
        files: [],
        error: getI18n().t('addTorrent.preview.magnetRequired'),
      })
      setSelectedFileIndices(new Set())
      previewMetaRef.current = null
      return
    }

    if (magnets.length > 1) {
      setPreviewState({
        status: 'error',
        source: 'magnet',
        files: [],
        error: getI18n().t('addTorrent.preview.magnetMultiple'),
      })
      setSelectedFileIndices(new Set())
      previewMetaRef.current = null
      return
    }

    const magnetUri = magnets[0]
    await clearPreview()

    const requestId = ++previewRequestIdRef.current
    setPreviewState({ status: 'loading', source: 'magnet', files: [] })

    try {
      const result = await QBittorrentClient.shared.previewMagnet(magnetUri)
      if (previewRequestIdRef.current !== requestId) return

      previewMetaRef.current = {
        type: 'magnet',
        hash: result.hash,
        magnetUri,
        existed: result.existed,
      }

      const files = result.files.map((file) => ({
        index: file.index,
        path: file.name,
        size: file.size,
      }))
      setPreviewState({
        status: 'ready',
        source: 'magnet',
        name: result.name,
        hash: result.hash,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        files,
        displayName: result.displayName,
      })
      setSelectedFileIndices(new Set(files.map((f) => f.index)))
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) return

      previewMetaRef.current = null
      setPreviewState({
        status: 'error',
        source: 'magnet',
        files: [],
        error:
          error instanceof Error
            ? error.message
            : String(error ?? 'Unknown error'),
      })
      setSelectedFileIndices(new Set())
    }
  })

  const toggleFileSelection = useEventCallback(
    (index: number, next?: boolean) => {
      setSelectedFileIndices((prev) => {
        const updated = new Set(prev)
        const shouldSelect = next ?? !prev.has(index)
        if (shouldSelect) updated.add(index)
        else updated.delete(index)
        return updated
      })
    },
  )

  const toggleAllFileSelections = useEventCallback((select: boolean) => {
    if (previewState.status !== 'ready') return
    if (select) {
      setSelectedFileIndices(
        new Set(previewState.files.map((file) => file.index)),
      )
    } else {
      setSelectedFileIndices(new Set())
    }
  })

  const waitForTorrentPresence = useEventCallback(
    async (hash: string, timeoutMs?: number) => {
      const effectiveTimeout =
        typeof timeoutMs === 'number' && Number.isFinite(timeoutMs)
          ? timeoutMs
          : 20000
      const deadline = Date.now() + effectiveTimeout
      while (Date.now() < deadline) {
        try {
          const [info] = await QBittorrentClient.shared.requestTorrentsInfo({
            hashes: hash,
          })
          if (info) return
        } catch {
          // ignore transient errors while waiting
        }
        await delay(750)
      }
      throw new Error('Timed out waiting for torrent registration')
    },
  )

  const applyFilePriorities = useEventCallback(
    async (hash: string, deselected: number[]) => {
      if (deselected.length === 0) return
      await QBittorrentClient.shared.requestSetFilePriority(hash, deselected, 0)
    },
  )

  const applyTorrentSettings = useEventCallback(
    async (hash: string, existed: boolean) => {
      const client = QBittorrentClient.shared

      const savePath = formData.savepath?.trim()
      if (savePath) {
        await client.setTorrentLocation(hash, savePath)
      }

      const category = formData.category?.trim()
      if (category) {
        await client.setTorrentCategory(hash, category)
      } else if (!existed) {
        await client.resetTorrentCategory(hash)
      }

      if (formData.tags?.trim()) {
        const tags = formData.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
        if (tags.length > 0) {
          await client.addTorrentTags(hash, tags.join(','))
        }
      }

      if (formData.rename?.trim()) {
        await client.setTorrentName(hash, formData.rename.trim())
      }

      if (formData.autoTMM !== undefined) {
        await client.requestSetAutoManagement(hash, formData.autoTMM)
      }

      const { ratioLimit } = formData
      const { seedingTimeLimit } = formData
      if (ratioLimit !== undefined || seedingTimeLimit !== undefined) {
        await client.requestSetShareLimits(hash, ratioLimit, seedingTimeLimit)
      }

      const downloadLimit =
        formData.limitDownloadKiBs !== ''
          ? Number(formData.limitDownloadKiBs) * 1024
          : formData.dlLimit
      if (
        downloadLimit !== undefined &&
        !Number.isNaN(downloadLimit) &&
        downloadLimit >= 0
      ) {
        await client.setTorrentDownloadLimit(hash, downloadLimit)
      }

      const uploadLimit =
        formData.limitUploadKiBs !== ''
          ? Number(formData.limitUploadKiBs) * 1024
          : formData.upLimit
      if (
        uploadLimit !== undefined &&
        !Number.isNaN(uploadLimit) &&
        uploadLimit >= 0
      ) {
        await client.setTorrentUploadLimit(hash, uploadLimit)
      }

      const [info] = await client.requestTorrentsInfo({ hashes: hash })
      if (
        info &&
        formData.sequentialDownload !== undefined &&
        Boolean(info.seq_dl) !== Boolean(formData.sequentialDownload)
      ) {
        await client.requestToggleSequentialDownload(hash)
      }

      if (
        info &&
        formData.firstLastPiecePrio !== undefined &&
        Boolean(info.f_l_piece_prio) !== Boolean(formData.firstLastPiecePrio)
      ) {
        await client.requestToggleFirstLastPiecePriority(hash)
      }
    },
  )

  const handleSubmit = useEventCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const actions = TorrentActions.shared
      const previewMeta = previewMetaRef.current
      const previewReady = previewState.status === 'ready'
      const deselected = previewReady
        ? previewState.files
            .filter((file) => !selectedFileIndices.has(file.index))
            .map((file) => file.index)
        : []

      if (previewMeta?.type === 'magnet' && previewReady) {
        await applyFilePriorities(previewMeta.hash, deselected)
        await applyTorrentSettings(previewMeta.hash, previewMeta.existed)

        if (formData.startTorrent) {
          await QBittorrentClient.shared.resumeTorrent(previewMeta.hash)
        } else {
          await QBittorrentClient.shared.pauseTorrent(previewMeta.hash)
        }

        previewMetaRef.current = { ...previewMeta, finalized: true }
      } else {
        const overrides: Partial<AddTorrentOptions> = {}
        if (previewMeta?.type === 'file' && previewReady) {
          overrides.stopped = true
        }

        const addOptions = createAddTorrentOptions(formData, overrides)
        await actions.addTorrent(addOptions)

        if (previewMeta?.type === 'file' && previewReady) {
          const hash = previewMeta.infoHash.toUpperCase()
          await waitForTorrentPresence(hash)
          await applyFilePriorities(hash, deselected)
          await applyTorrentSettings(hash, false)

          if (formData.startTorrent) {
            await QBittorrentClient.shared.resumeTorrent(hash)
          } else {
            await QBittorrentClient.shared.pauseTorrent(hash)
          }

          previewMetaRef.current = { ...previewMeta, finalized: true }
        }
      }

      resetFormData()
      setPreviewState({ status: 'idle', files: [] })
      setSelectedFileIndices(new Set())
      previewMetaRef.current = null

      toast.success(getI18n().t('messages.torrentsAdded'))
      dismiss()
    } catch (error) {
      console.error(`${getI18n().t('messages.torrentsAddFailed')}:`, error)
      toast.error(getI18n().t('messages.torrentsAddFailed'))
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    return () => {
      const meta = previewMetaRef.current
      if (
        meta?.type === 'magnet' &&
        !meta.existed &&
        !meta.finalized &&
        meta.hash
      ) {
        void QBittorrentClient.shared.removeTorrent(meta.hash, false)
      }
    }
  }, [])

  useEffect(() => {
    const meta = previewMetaRef.current
    if (meta?.type === 'magnet') {
      const magnets = getMagnetLinks(formData.magnetLinks)
      if (!magnets.includes(meta.magnetUri)) {
        void clearPreview()
      }
    }
  }, [formData.magnetLinks, clearPreview])

  useEffect(() => {
    if (
      formData.files.length > 0 &&
      previewState.status === 'idle' &&
      !previewMetaRef.current
    ) {
      void loadFilePreview(formData.files[0])
    }
  }, [formData.files, loadFilePreview, previewState.status])

  useEffect(() => {
    const meta = previewMetaRef.current
    if (meta?.type === 'file') {
      const stillPresent = formData.files.some(
        (file) => file.name === meta.fileName,
      )
      if (!stillPresent) {
        if (formData.files.length > 0) {
          void loadFilePreview(formData.files[0])
        } else {
          void clearPreview()
        }
      }
    }
  }, [formData.files, clearPreview, loadFilePreview])

  const hasSelection = useMemo(
    () => previewState.status !== 'ready' || selectedFileIndices.size > 0,
    [previewState.status, selectedFileIndices],
  )

  const combinedIsFormValid = baseIsFormValid && hasSelection

  const handlers = {
    setFormData,
    handleFilesSelected,
    removeFile,
    loadMagnetPreview,
    refreshFilePreview,
    clearPreview,
    toggleFileSelection,
    toggleAllFileSelections,
    previewState,
    selectedFileIndices,
    isPreviewLoading: previewState.status === 'loading',
  }

  return {
    formData,
    setFormData,
    resetFormData,
    isFormValid: combinedIsFormValid,
    categories,
    isLoading,
    setIsLoading,
    handleSubmit,
    handlers,
  }
}
