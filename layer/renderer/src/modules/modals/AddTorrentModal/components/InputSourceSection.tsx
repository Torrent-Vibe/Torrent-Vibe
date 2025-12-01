import clsx from 'clsx'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Label } from '~/components/ui/label/Label'
import { Modal } from '~/components/ui/modal/ModalManager'

import { FileUploadArea } from '../FileUploadArea'
import { MagnetLinksInput } from '../MagnetLinksInput'
import type { TorrentFormData, TorrentFormHandlers } from '../types'
import { TorrentPreviewDialog } from './TorrentPreviewDialog'
import { TorrentPreviewSummary } from './TorrentPreviewSummary'

interface InputSourceSectionProps {
  formData: TorrentFormData
  handlers: TorrentFormHandlers
}

export const InputSourceSection = ({
  formData,
  handlers,
}: InputSourceSectionProps) => {
  const { t } = useTranslation()
  // UI mode: both sections, or focused on one
  const [mode, setMode] = useState<'both' | 'magnet' | 'file'>('both')

  const hasFiles = formData.files.length > 0
  const hasMagnet = useMemo(
    () => formData.magnetLinks.trim().length > 0,
    [formData.magnetLinks],
  )

  // Auto switch from initial "both" to single section when user starts using one
  useEffect(() => {
    if (mode === 'both') {
      if (hasFiles) setMode('file')
      else if (hasMagnet) setMode('magnet')
    }
  }, [mode, hasFiles, hasMagnet])

  // Keep mode in sync if current source becomes empty
  useEffect(() => {
    if (mode === 'file') {
      if (!hasFiles && hasMagnet) setMode('magnet')
      else if (!hasFiles && !hasMagnet) setMode('both')
    } else if (mode === 'magnet') {
      if (!hasMagnet && hasFiles) setMode('file')
      else if (!hasMagnet && !hasFiles) setMode('both')
    }
  }, [mode, hasFiles, hasMagnet])

  const revertToInitial = (type: 'file' | 'magnet') => {
    if (type === 'file') {
      void clearPreview()
      handlers.setFormData((prev) => ({ ...prev, files: [], method: 'magnet' }))
    } else {
      void clearPreview()
      handlers.setFormData((prev) => ({
        ...prev,
        magnetLinks: '',
        method: 'magnet',
      }))
    }
    setMode('both')
  }

  const [fixedHeight, setFixedHeight] = useState<number | undefined>()

  const containerRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (containerRef.current) {
      setFixedHeight(containerRef.current.getBoundingClientRect().height)
    }
  }, [containerRef])

  const {
    previewState,
    selectedFileIndices,
    isPreviewLoading,
    toggleFileSelection,
    toggleAllFileSelections,
    clearPreview,
    loadMagnetPreview,
    refreshFilePreview,
  } = handlers

  const previewSource = previewState.source
  const handlePreviewReload = useMemo<
    (() => Promise<void> | void) | undefined
  >(() => {
    if (previewSource === 'magnet') {
      return () => {
        void loadMagnetPreview()
      }
    }
    if (previewSource === 'file') {
      return () => {
        void refreshFilePreview()
      }
    }
    return
  }, [loadMagnetPreview, previewSource, refreshFilePreview])

  const previewModalIdRef = useRef<string | null>(null)

  const handlePreviewModalUnmount = useCallback(() => {
    previewModalIdRef.current = null
  }, [])

  const dismissPreviewModal = useCallback(() => {
    if (!previewModalIdRef.current) return
    Modal.dismiss(previewModalIdRef.current)
    previewModalIdRef.current = null
  }, [])

  const handleClearPreview = useCallback(() => {
    dismissPreviewModal()
    return clearPreview()
  }, [clearPreview, dismissPreviewModal])

  const previewModalProps = useMemo(
    () => ({
      state: previewState,
      selectedFileIndices,
      onToggleFile: toggleFileSelection,
      onToggleAll: toggleAllFileSelections,
      onReload: handlePreviewReload,
      onClear: handleClearPreview,
      isLoading: isPreviewLoading,
      onDismiss: handlePreviewModalUnmount,
    }),
    [
      previewState,
      selectedFileIndices,
      toggleFileSelection,
      toggleAllFileSelections,
      handlePreviewReload,
      handleClearPreview,
      isPreviewLoading,
      handlePreviewModalUnmount,
    ],
  )

  const handleOpenPreview = useCallback(() => {
    if (previewState.status === 'idle') return
    const id = Modal.present(TorrentPreviewDialog, previewModalProps)
    previewModalIdRef.current = id
  }, [previewState.status, previewModalProps])

  useEffect(() => {
    if (!previewModalIdRef.current) return
    if (previewState.status === 'idle') {
      dismissPreviewModal()
      return
    }
    const id = Modal.present(TorrentPreviewDialog, previewModalProps)
    previewModalIdRef.current = id
  }, [dismissPreviewModal, previewModalProps, previewState.status])

  return (
    <div
      className="flex flex-col gap-5 min-w-0 grow min-h-0"
      ref={containerRef}
      style={{ height: fixedHeight ? `${fixedHeight}px` : undefined }}
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <i className="i-mingcute-file-line text-text-secondary" />
          {t('addTorrent.input')}
        </Label>
        <p className="text-xs text-text-secondary">
          {t('addTorrent.inputDescription')}
        </p>
      </div>
      {/* Magnet section (always rendered) */}
      <div
        className={clsx('relative flex flex-col', mode === 'magnet' && 'grow')}
      >
        {mode === 'file' && (
          <div className="flex items-center justify-between rounded-md bg-fill/30 px-3 py-2">
            <p className="text-xs text-text-secondary flex items-center gap-2">
              {t('addTorrent.inputSource.hint.file')}
            </p>
            <button
              type="button"
              onClick={() => revertToInitial('file')}
              className="text-xs text-accent flex items-center hover:underline px-1 py-0.5"
            >
              {t('addTorrent.inputSource.revert')}
            </button>
          </div>
        )}
        <div className={mode === 'file' ? 'hidden' : 'grow flex flex-col'}>
          <MagnetLinksInput formData={formData} handlers={handlers} />
        </div>
      </div>

      {/* Divider */}
      <div className={mode === 'both' ? 'relative h-4' : 'hidden'}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center -my-2.5">
          <span className="bg-background px-3 text-[10px] text-text-secondary uppercase tracking-wider font-medium">
            {t('common.or')}
          </span>
        </div>
      </div>

      {/* File section (always rendered) */}
      {mode === 'magnet' && (
        <div className="flex items-start justify-between rounded-md -mt-5">
          <p className="text-xs text-text-secondary flex items-center gap-2">
            <i className="i-mingcute-hint-line" />
            {t('addTorrent.inputSource.hint.magnet')}
          </p>
          <button
            type="button"
            onClick={() => revertToInitial('magnet')}
            className="text-xs text-accent hover:underline px-1 py-0.5"
          >
            {t('addTorrent.inputSource.revert')}
          </button>
        </div>
      )}
      {mode !== 'magnet' && (
        <FileUploadArea formData={formData} handlers={handlers} />
      )}

      <TorrentPreviewSummary
        state={previewState}
        selectedFileIndices={selectedFileIndices}
        onOpenPreview={handleOpenPreview}
        onReload={handlePreviewReload}
        onClear={handleClearPreview}
        isLoading={isPreviewLoading}
      />
    </div>
  )
}
