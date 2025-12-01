import { useMemo } from 'react'

import { useQBQuery } from '~/lib/query/query-hooks'

import {
  torrentDataStoreSetters,
  useTorrentDataStore,
} from '../stores/torrent-data-store'

export interface CategoryWithCount {
  name: string
  savePath: string
  count: number
}

/**
 * Hook to get categories with torrent counts
 */
export const useCategoriesWithCounts = () => {
  const categories = useTorrentDataStore((state) => state.categories)
  const torrents = useTorrentDataStore((state) => state.torrents)

  const { data, isLoading, error } = useQBQuery.categories()

  // Update the store when data changes
  if (data && data !== categories) {
    torrentDataStoreSetters.setCategories(data)
  }

  const categoriesWithCounts = useMemo(() => {
    const categoriesData = (categories || data) as
      | Record<string, { savePath: string }>
      | undefined
    if (!categoriesData || !torrents) return []

    return Object.entries(categoriesData).map(
      ([categoryName, categoryInfo]) => ({
        name: categoryName,
        savePath: categoryInfo.savePath,
        count: torrents.filter((torrent) => torrent.category === categoryName)
          .length,
      }),
    )
  }, [categories, data, torrents])

  return {
    categories: categoriesWithCounts,
    isLoading,
    error,
  }
}
