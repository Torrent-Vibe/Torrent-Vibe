import type { Preferences } from '@innei/qbittorrent-browser'
import { atom } from 'jotai'
import { useEffect } from 'react'
import { useEventCallback } from 'usehooks-ts'

import { createAtomHooks, createAtomSelector, jotaiStore } from '~/lib/jotai'
import { useQBMutation, useQBQuery } from '~/lib/query/query-hooks'

// Base prefs loaded from server
const basePrefsAtom = atom<Partial<Preferences> | null>(null)

// Dirty edits made in UI but not yet saved
const dirtyPrefsAtom = atom<Partial<Preferences>>({})

// Combined view for consumers
const combinedPrefsAtom = atom<Partial<Preferences>>((get) => {
  const base = get(basePrefsAtom) ?? {}
  const dirty = get(dirtyPrefsAtom)
  return { ...base, ...dirty }
})

// Hooks/accessors
const [, , useDirtyPrefsValue, , getDirtyPrefs, setDirtyPrefs] =
  createAtomHooks(dirtyPrefsAtom)

const usePrefsValue = createAtomSelector(combinedPrefsAtom)

const [, , useBasePrefsValue, , getBasePrefs, setBasePrefs] =
  createAtomHooks(basePrefsAtom)

// Utility to merge updates into dirty state (shallow)
export const useUpdatePrefs = () => {
  return (updates: Partial<Preferences>) => {
    setDirtyPrefs({ ...getDirtyPrefs(), ...updates })
  }
}

// Allow programmatic reset of draft
export const resetDraftPrefs = () => setDirtyPrefs({})

// Expose selectors
export const usePrefs = () => usePrefsValue((v) => v)
export const useBasePrefs = () => useBasePrefsValue()
export const useDirtyPrefs = () => useDirtyPrefsValue()

// Manager hook: loads, tracks, and saves prefs with dirty-only updates
export const useQBittorrentPrefsManager = () => {
  const { data, isLoading, error } = useQBQuery.qbittorrentPreferences()
  const mutation = useQBMutation.qbittorrent.setPreferences()

  // Sync fetched prefs into base store and clear draft when server data changes
  useEffect(() => {
    if (!data) return
    const currentBase = getBasePrefs()
    if (!currentBase || currentBase !== data) {
      setBasePrefs(data)
      resetDraftPrefs()
    }
  }, [data])

  const save = async () => {
    const dirty = getDirtyPrefs()
    if (!dirty || Object.keys(dirty).length === 0) return

    await mutation.mutateAsync(dirty)
    // On success, merge dirty into base and clear draft
    const base = getBasePrefs() ?? {}
    setBasePrefs({ ...base, ...dirty })
    resetDraftPrefs()
  }

  const update = useEventCallback((updates: Partial<Preferences>) => {
    setDirtyPrefs({ ...getDirtyPrefs(), ...updates })
  })

  const reset = useEventCallback(() => {
    resetDraftPrefs()
  })

  return {
    prefs: usePrefs(),
    base: useBasePrefs(),
    dirty: useDirtyPrefs(),
    update,
    save,
    reset,
    isLoading,
    isSaving: mutation.isPending,
    error,
  }
}

// Non-hook helpers for imperative contexts
export const prefsStore = {
  getBase: getBasePrefs,
  setBase: setBasePrefs,
  getDirty: getDirtyPrefs,
  setDirty: setDirtyPrefs,
  getCombined: () => jotaiStore.get(combinedPrefsAtom),
}
