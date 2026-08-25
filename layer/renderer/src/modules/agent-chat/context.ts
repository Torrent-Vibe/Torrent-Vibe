import type { AgentChatContext, AgentChatFilter } from '@torrent-vibe/shared'

import { getI18n } from '~/i18n'
import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'
import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'
import { useTorrentTableStore } from '~/modules/torrent/stores/torrent-table-store'
import type { TorrentFilterState } from '~/modules/torrent/types/store'

export const projectAgentFilter = (
  filterState: TorrentFilterState,
  searchQuery = '',
): AgentChatFilter => {
  const filter: AgentChatFilter = {
    categories: [],
    search: searchQuery.trim(),
    statuses: [],
    tags: [],
  }

  if (typeof filterState === 'string') {
    if (filterState !== 'all') {
      filter.statuses = [filterState]
    }
    return filter
  }

  if (filterState.type === 'category') {
    filter.categories = [filterState.value]
  } else if (filterState.type === 'tag') {
    filter.tags = [filterState.value]
  } else {
    filter.categories = [...(filterState.categories ?? [])]
    filter.statuses = [...(filterState.statuses ?? [])]
    filter.tags = [...(filterState.tags ?? [])]
  }
  return filter
}

export const createAgentContext = (input: {
  activeServerId: string | null
  activeServerName: string | null
  filterState: TorrentFilterState
  locale: string
  searchQuery?: string
  selectedTorrentHashes: string[]
  visibleTorrentCount: number
}): AgentChatContext => ({
  activeServerId: input.activeServerId,
  activeServerName: input.activeServerName,
  capturedAt: Date.now(),
  filter: projectAgentFilter(input.filterState, input.searchQuery),
  locale: input.locale,
  selectedTorrentHashes: [...new Set(input.selectedTorrentHashes)],
  visibleTorrentCount: input.visibleTorrentCount,
})

export const captureAgentContext = (
  selectedTorrentHashes?: string[],
): AgentChatContext => {
  const torrentState = useTorrentDataStore.getState()
  const activeTorrentHash = useTorrentTableStore.getState().activeTorrentHash
  const serverState = useMultiServerStore.getState()
  const activeServer = serverState.activeServerId
    ? serverState.servers[serverState.activeServerId]
    : null

  return createAgentContext({
    activeServerId: serverState.activeServerId,
    activeServerName: activeServer?.name ?? null,
    filterState: torrentState.filterState,
    locale: getI18n().language,
    searchQuery: torrentState.searchQuery,
    selectedTorrentHashes:
      selectedTorrentHashes ??
      (torrentState.selectedTorrents.length > 0
        ? torrentState.selectedTorrents
        : activeTorrentHash
          ? [activeTorrentHash]
          : []),
    visibleTorrentCount: torrentState.sortedTorrents.length,
  })
}
