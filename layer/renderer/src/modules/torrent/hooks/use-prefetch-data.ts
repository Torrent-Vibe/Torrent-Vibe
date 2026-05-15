import { usePollingInterval } from '~/atoms/settings/general'
import { useAuthQuery } from '~/lib/query/use-auth-query'

import { useTorrentDataStore } from '../stores'
import { TorrentActions } from '../stores/torrent-actions'
import { isTorrentTableScrollActive } from '../stores/torrent-table-performance'

const getTorrentSnapshot = () => {
  const { serverState, torrents } = useTorrentDataStore.getState()
  return { torrents, serverState }
}

/**
 * Hook that prefetches torrent data and server state using React Query
 * Data is stored and managed by the Zustand store
 * Components should use store selectors to access data
 */
export const usePrefetchTorrents = () => {
  const pollingInterval = usePollingInterval()

  return useAuthQuery({
    queryKey: ['torrents', 'serverState', 'prefetch'],
    queryFn: ({ signal }) => {
      if (isTorrentTableScrollActive()) {
        return getTorrentSnapshot()
      }

      return TorrentActions.shared.fetchTorrentsAndServerState(signal)
    },
    refetchInterval: pollingInterval,
    refetchOnWindowFocus: true,
    staleTime: Math.max(pollingInterval - 500, 1000),
    retry: 3,
    retryDelay: attemptIndex => 2 ** attemptIndex * 1000,
  })
}

export const usePrefetchTransferInfo = () => {
  const pollingInterval = usePollingInterval()

  return useAuthQuery({
    queryKey: ['torrents', 'transferInfo', 'prefetch'],
    queryFn: () => {
      if (isTorrentTableScrollActive()) {
        return useTorrentDataStore.getState().serverState
      }

      return TorrentActions.shared.fetchTransferInfo()
    },
    refetchInterval: pollingInterval,
    refetchIntervalInBackground: true,
  })
}
