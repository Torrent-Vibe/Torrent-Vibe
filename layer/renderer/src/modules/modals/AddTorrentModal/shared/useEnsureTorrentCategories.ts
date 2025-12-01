import { useEffect } from 'react'

import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'

export const useEnsureTorrentCategories = (
  categories: Record<string, any> | undefined | null,
) => {
  useEffect(() => {
    if (!categories) {
      TorrentActions.shared.fetchCategories()
    }
  }, [categories])
}
