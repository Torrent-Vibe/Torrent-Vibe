import { useEffect, useState } from 'react'
import { useEventCallback } from 'usehooks-ts'

import {
  extractPersistentData,
  mergePersistentData,
  useAddTorrentFormPersistent,
} from '~/atoms/add-torrent-form'
import { useQBittorrentPreferences } from '~/modules/modals/SettingsModal/hooks/useQBittorrentPreferences'
import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'

import type { InputMethod, TorrentFormData } from '../types'

export const useAddTorrentForm = (initialFiles?: File[]) => {
  const { data: qbPrefs } = useQBittorrentPreferences()
  const [persistentData, setPersistentData] = useAddTorrentFormPersistent()
  const categories = useTorrentDataStore((s) => s.categories)

  // Initialize form data with persistent settings and initial files if provided
  const [formData, setFormData] = useState<TorrentFormData>(() => {
    const baseData = mergePersistentData(persistentData)

    if (initialFiles && initialFiles.length > 0) {
      return {
        ...baseData,
        ...qbPrefs,
        method: 'file',
        files: initialFiles.filter((f) => f.name.endsWith('.torrent')),
      }
    }

    return baseData
  })

  // Initialize Auto TMM default from settings once when preferences load
  useEffect(() => {
    if (!qbPrefs?.auto_tmm_enabled) return

    setFormData((prev) => ({
      ...prev,
      autoTMM: Boolean(qbPrefs.auto_tmm_enabled),
    }))
  }, [qbPrefs])

  // When Auto TMM is enabled, mirror the resolved save path into the UI field
  useEffect(() => {
    const categoryName = formData.category
    const categoryConfig = categoryName ? categories?.[categoryName] : undefined
    const resolvedPath =
      (categoryConfig?.savePath?.trim?.() as string | undefined) ||
      (qbPrefs?.save_path?.trim?.() as string | undefined) ||
      ''

    setFormData((prev) =>
      prev.savepath === resolvedPath
        ? prev
        : { ...prev, savepath: resolvedPath },
    )
  }, [formData.autoTMM, formData.category, categories, qbPrefs])

  // Persist form data changes (excluding files and magnetLinks)
  const persistFormData = useEventCallback((newFormData: TorrentFormData) => {
    const newPersistentData = extractPersistentData(newFormData)
    setPersistentData(newPersistentData)
  })

  // Enhanced setFormData that also persists changes
  const setFormDataWithPersistence = useEventCallback(
    (
      updater: TorrentFormData | ((prev: TorrentFormData) => TorrentFormData),
    ) => {
      setFormData((prev) => {
        const newData = typeof updater === 'function' ? updater(prev) : updater

        // Persist the changes asynchronously
        requestAnimationFrame(() => {
          persistFormData(newData)
        })

        return newData
      })
    },
  )

  const handleInputMethodChange = useEventCallback((method: InputMethod) => {
    setFormDataWithPersistence((prev) => ({
      ...prev,
      method,
      // Clear the other method's data
      magnetLinks: method === 'file' ? '' : prev.magnetLinks,
      files: method === 'magnet' ? [] : prev.files,
    }))
  })

  const resetFormData = useEventCallback(() => {
    const resetData = mergePersistentData(persistentData, {
      ...mergePersistentData(persistentData),
      magnetLinks: '',
      files: [],
    })
    setFormData(resetData)
  })

  const hasValidMagnets =
    formData.magnetLinks.trim() !== '' &&
    formData.magnetLinks.includes('magnet:')
  const hasFiles = formData.files.length > 0
  const isFormValid = hasValidMagnets || hasFiles

  return {
    formData,
    setFormData: setFormDataWithPersistence,
    handleInputMethodChange,
    resetFormData,
    isFormValid,
    categories,
  }
}
