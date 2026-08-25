import { useTranslation } from 'react-i18next'

import { Logo } from '~/components/app/logo'
import { SpeedIndicators } from '~/components/common/SpeedIndicators'
import { Button } from '~/components/ui/button/Button'
import { Modal } from '~/components/ui/modal/ModalManager'
import { cn } from '~/lib/cn'
import { AgentChatActions } from '~/modules/agent-chat'
import { useDiscoverProviders } from '~/modules/discover/hooks/useDiscoverProviders'
import { openDiscover } from '~/modules/modals/DiscoverModal'
import { ServerSwitcher } from '~/modules/multi-server/components/ServerSwitcher'
import { useHasSelection } from '~/modules/torrent/hooks/use-torrent-computed'
import { useTorrentDataStore } from '~/modules/torrent/stores'
import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

import { AddTorrentModal } from '../../../modals/AddTorrentModal'
import { TorrentSearchInput } from './TorrentSearchInput'

interface MacOSHeaderProps {
  className?: string
  showSearch?: boolean
}

export const MacOSHeader = ({
  className,
  showSearch = true,
}: MacOSHeaderProps) => {
  const hasSelection = useHasSelection()
  const activeTorrentHash = useTorrentTableSelectors.useActiveTorrentHash()

  const canInteract = hasSelection || activeTorrentHash

  // Torrent action handler
  const handleTorrentAction = async (action: 'pause' | 'resume' | 'delete') => {
    if (!canInteract) {
      return
    }

    const hashes = hasSelection
      ? useTorrentDataStore.getState().selectedTorrents
      : activeTorrentHash
        ? [activeTorrentHash]
        : []

    try {
      const actions = TorrentActions.shared
      switch (action) {
        case 'pause': {
          await actions.pauseTorrents(hashes)
          break
        }
        case 'resume': {
          await actions.resumeTorrents(hashes)
          break
        }
        case 'delete': {
          await actions.deleteTorrents(hashes)
          break
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} torrents:`, error)
    }
  }
  const providers = useDiscoverProviders()
  const hasReadyProviders = providers.some((provider) => provider.ready)
  const { t } = useTranslation()
  const openAgent = () => AgentChatActions.shared.openPanel()
  return (
    <header
      className={cn(
        'h-[80px] drag-region select-none bg-transparent border-b border-border flex flex-col',
        className,
      )}
    >
      {/* First Row: Logo + Search - with traffic light safe area */}
      <div className="flex items-center relative pl-4 pr-2 h-10 pt-2">
        {/* macOS Traffic Light Buttons Area - Reserved Space */}
        <div className="w-[65px] flex-shrink-0" />

        {/* Logo */}
        <div className="flex items-center gap-1 flex-1">
          <Logo className="w-5 h-5 text-sky-500" />
          <span className="text-sm font-medium text-text tracking-tight">
            Torrent Vibe
          </span>
        </div>

        {/* Search Area */}
        {showSearch && (
          <div className="flex items-center gap-2 [&_input]:shadow-none">
            <TorrentSearchInput fullRounded variant="compact" />

            <Button
              aria-label={t('agent.open')}
              className="p-2 hover:bg-fill rounded-full"
              size="md"
              title={t('agent.open')}
              variant="ghost"
              onClick={openAgent}
            >
              <i className="i-mingcute-brain-line text-sm" />
            </Button>

            {hasReadyProviders && (
              <Button
                aria-label={t('buttons.discover')}
                className="p-2 hover:bg-fill rounded-full"
                size="md"
                variant="ghost"
                onClick={() => openDiscover()}
              >
                <i className="i-mingcute-safari-line text-sm" />
              </Button>
            )}
            <div className="flex items-center">
              {ELECTRON && <ServerSwitcher className="mr-1" />}
            </div>
          </div>
        )}
      </div>

      {/* Second Row: Action Buttons + Speed Indicators */}
      <div className="flex-1 flex items-center justify-between px-4">
        {/* Left: Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            className="h-8 px-4 text-sm font-medium shadow-sm"
            variant="primary"
            onClick={() => {
              Modal.present(AddTorrentModal)
            }}
          >
            <i className="i-mingcute-add-line mr-2 text-sm" />
            {t('common.add')}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              className="h-8 w-8 p-0 hover:bg-green/10 hover:text-green text-green/70 disabled:text-text-quaternary"
              disabled={!canInteract}
              title="Resume selected torrents"
              variant="ghost"
              onClick={() => handleTorrentAction('resume')}
            >
              <i className="i-mingcute-play-fill text-sm" />
            </Button>
            <Button
              className="h-8 w-8 p-0 hover:bg-orange/10 hover:text-orange text-orange/70 disabled:text-text-quaternary"
              disabled={!canInteract}
              title="Pause selected torrents"
              variant="ghost"
              onClick={() => handleTorrentAction('pause')}
            >
              <i className="i-mingcute-pause-fill text-sm" />
            </Button>
            <Button
              className="h-8 w-8 p-0 hover:bg-red/10 hover:text-red text-red/70 disabled:text-text-quaternary"
              disabled={!canInteract}
              title="Delete selected torrents"
              variant="ghost"
              onClick={() => handleTorrentAction('delete')}
            >
              <i className="i-mingcute-delete-2-line text-sm" />
            </Button>
          </div>
        </div>

        {/* Right: Disk Usage and Speed Indicators */}
        <SpeedIndicators variant="compact" />
      </div>
    </header>
  )
}
