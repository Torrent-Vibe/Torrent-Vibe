import type { Preferences } from '@innei/qbittorrent-browser'
import { useEffect } from 'react'

import { useQBMutation, useQBQuery } from '~/lib/query/query-hooks'

type UseQBittorrentPreferencesOptions = {
  onFetchSuccess?: (prefs: Preferences) => void
  onFetchError?: (error: unknown) => void
  onSaveSuccess?: () => void
  onSaveError?: (error: unknown) => void
}

export function useQBittorrentPreferences(
  options?: UseQBittorrentPreferencesOptions,
) {
  const { data, isLoading, error, refetch } =
    useQBQuery.qbittorrentPreferences()
  const mutation = useQBMutation.qbittorrent.setPreferences()

  useEffect(() => {
    if (data) {
      options?.onFetchSuccess?.(data)
    }
  }, [data, options])

  useEffect(() => {
    if (error) {
      options?.onFetchError?.(error)
    }
  }, [error, options])

  // Override the mutation's onSuccess and onError to include the options callbacks
  const mutateWithCallbacks = async (newPrefs: Partial<Preferences>) => {
    try {
      await mutation.mutateAsync(newPrefs)
      options?.onSaveSuccess?.()
    } catch (err) {
      options?.onSaveError?.(err)
      throw err
    }
  }

  return {
    data,
    isLoading,
    error,
    refetch,
    mutate: mutateWithCallbacks,
    mutateAsync: mutateWithCallbacks,
    isPending: mutation.isPending,
  }
}
