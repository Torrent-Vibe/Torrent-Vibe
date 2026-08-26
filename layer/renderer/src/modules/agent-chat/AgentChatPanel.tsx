import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '~/components/ai-elements/conversation'
import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'
import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

import { AssistantTurn } from './components/AssistantTurn'
import { Composer } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { UserMessage } from './components/UserMessage'
import { createAgentContext } from './context'
import { useAgentChatStore } from './store'

export const AgentChatPanel = () => {
  const { i18n } = useTranslation()
  const draftContext = useAgentChatStore((state) => state.draftContext)
  const messages = useAgentChatStore((state) => state.messages)
  const torrentContext = useTorrentDataStore(
    useShallow((state) => ({
      filterState: state.filterState,
      searchQuery: state.searchQuery,
      selectedTorrentHashes: state.selectedTorrents,
      visibleTorrentCount: state.sortedTorrents.length,
    })),
  )
  const serverContext = useMultiServerStore(
    useShallow((state) => {
      const activeServer = state.activeServerId
        ? state.servers[state.activeServerId]
        : null
      return {
        activeServerId: state.activeServerId,
        activeServerName: activeServer?.name ?? null,
        multiServer: Object.keys(state.servers).length > 1,
      }
    }),
  )
  const activeTorrentHash = useTorrentTableSelectors.useActiveTorrentHash()
  const liveContext = createAgentContext({
    activeServerId: serverContext.activeServerId,
    activeServerName: serverContext.activeServerName,
    filterState: torrentContext.filterState,
    locale: i18n.language,
    searchQuery: torrentContext.searchQuery,
    selectedTorrentHashes:
      torrentContext.selectedTorrentHashes.length > 0
        ? torrentContext.selectedTorrentHashes
        : activeTorrentHash
          ? [activeTorrentHash]
          : [],
    visibleTorrentCount: torrentContext.visibleTorrentCount,
  })
  const composerContext = draftContext ?? liveContext
  const selectedCount = composerContext.selectedTorrentHashes.length

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <EmptyState selectedCount={selectedCount} />
          ) : (
            <div className="min-w-0 space-y-5 px-4 py-5">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantTurn key={message.id} message={message} />
                ),
              )}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <Composer
        composerContext={composerContext}
        multiServer={serverContext.multiServer}
      />
    </div>
  )
}
