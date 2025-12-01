import { useMemo } from 'react'

import { useQBQuery } from '~/lib/query/query-hooks'

import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '../stores/torrent-data-store'

export interface TagWithCount {
  name: string
  count: number
}

/**
 * Hook to get tags with torrent counts
 */
export const useTagsWithCounts = () => {
  const tags = useTorrentDataStore((state) => state.tags)
  const torrents = useTorrentDataStore((state) => state.torrents)

  const { data, isLoading, error } = useQBQuery.tags()

  // Update the store when data changes
  if (data && data !== tags) {
    torrentDataStoreSetters.setTags(data)
  }

  const tagsWithCounts = useMemo(() => {
    const tagsData = tags || data
    if (!tagsData || !torrents) return []

    return tagsData.map((tagName) => ({
      name: tagName,
      count: torrents.filter((torrent) =>
        torrent.tags
          .split(', ')
          .filter((tag) => tag.trim())
          .includes(tagName),
      ).length,
    }))
  }, [tags, data, torrents])

  return {
    tags: tagsWithCounts,
    isLoading,
    error,
  }
}
