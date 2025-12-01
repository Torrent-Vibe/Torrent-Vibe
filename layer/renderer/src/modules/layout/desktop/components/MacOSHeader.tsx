import { useTranslation } from 'react-i18next'

import { Logo } from '~/components/app/logo'
import { SpeedIndicators } from '~/components/common/SpeedIndicators'
import { Button } from '~/components/ui/button/Button'
import { Modal } from '~/components/ui/modal/ModalManager'
import { cn } from '~/lib/cn'
import { useDiscoverProviders } from '~/modules/discover/hooks/useDiscoverProviders'
import { DiscoverModal } from '~/modules/modals/DiscoverModal'
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
    if (!canInteract) return

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
            <TorrentSearchInput variant="compact" fullRounded />

            {hasReadyProviders && (
              <Button
                variant="ghost"
                className="p-2 hover:bg-fill rounded-full"
                size="md"
                onClick={() => Modal.present(DiscoverModal)}
                aria-label={t('buttons.discover')}
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
            variant="primary"
            className="h-8 px-4 text-sm font-medium shadow-sm"
            onClick={() => {
              Modal.present(AddTorrentModal)
            }}
          >
            <i className="i-mingcute-add-line mr-2 text-sm" />
            {t('common.add')}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={!canInteract}
              onClick={() => handleTorrentAction('resume')}
              className="h-8 w-8 p-0 hover:bg-green/10 hover:text-green text-green/70 disabled:text-text-quaternary"
              title="Resume selected torrents"
            >
              <i className="i-mingcute-play-fill text-sm" />
            </Button>
            <Button
              variant="ghost"
              disabled={!canInteract}
              onClick={() => handleTorrentAction('pause')}
              className="h-8 w-8 p-0 hover:bg-orange/10 hover:text-orange text-orange/70 disabled:text-text-quaternary"
              title="Pause selected torrents"
            >
              <i className="i-mingcute-pause-fill text-sm" />
            </Button>
            <Button
              variant="ghost"
              disabled={!canInteract}
              onClick={() => handleTorrentAction('delete')}
              className="h-8 w-8 p-0 hover:bg-red/10 hover:text-red text-red/70 disabled:text-text-quaternary"
              title="Delete selected torrents"
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
