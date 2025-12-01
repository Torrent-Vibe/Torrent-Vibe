import { useTranslation } from 'react-i18next'

import { Logo } from '~/components/app/logo'
import { AuthStatusIndicator } from '~/components/common/AuthStatusIndicator'
import { SpeedIndicators } from '~/components/common/SpeedIndicators'
import { Button } from '~/components/ui/button/Button'
import { Modal } from '~/components/ui/modal/ModalManager'
import {
  useIsDark,
  useSetTheme,
  useThemeAtomValue,
} from '~/hooks/common/useDark'
import { cn } from '~/lib/cn'
import { useHasSelection } from '~/modules/torrent/hooks/use-torrent-computed'
import { useTorrentDataStore } from '~/modules/torrent/stores'
import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

import { AddTorrentModal } from '../../../modals/AddTorrentModal'
import { DiscoverModal } from '../../../modals/DiscoverModal'
import { presentSettingsModal } from '../../../modals/SettingsModal'
import { TorrentSearchInput } from './TorrentSearchInput'

interface StandardHeaderProps {
  className?: string
  showSearch?: boolean
}

export const StandardHeader = ({
  className,
  showSearch = true,
}: StandardHeaderProps) => {
  const { t } = useTranslation()
  const theme = useThemeAtomValue()
  const setTheme = useSetTheme()
  const isDark = useIsDark()

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

  const toggleTheme = () => {
    if (theme === 'system') {
      setTheme(isDark ? 'light' : 'dark')
    } else {
      const systemIsDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches
      if (theme === 'dark') {
        setTheme(systemIsDark ? 'light' : 'system')
      } else if (theme === 'light') {
        setTheme(systemIsDark ? 'system' : 'dark')
      }
    }
  }

  return (
    <header
      className={cn(
        'flex items-center @container justify-between h-[60px] px-6 bg-background border-b border-border',
        className,
      )}
    >
      {/* Left section: Logo and Action Buttons */}
      <div className="flex items-center gap-6 shrink min-w-0 grow">
        <div className="flex items-center gap-3 shrink-0">
          <Logo className="w-8 h-8" />
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-semibold text-text whitespace-pre">
              Torrent Vibe
            </span>
            <AuthStatusIndicator />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink min-w-0 grow">
          <Button
            variant="primary"
            className="shadow-md shrink-0"
            onClick={() => {
              Modal.present(AddTorrentModal)
            }}
          >
            <i className="i-mingcute-add-line mr-2" />
            {t('modals.addTorrent.title')}
          </Button>

          <div className="h-6 w-px bg-border mx-1 shrink-0" />

          <div className="flex items-center gap-1 shrink min-w-0 grow relative">
            <div className="@container flex grow">
              <Button
                variant="ghost"
                disabled={!canInteract}
                onClick={() => handleTorrentAction('resume')}
                className="hover:bg-green/10 hover:text-green text-green/80"
              >
                <i className="i-mingcute-play-fill mr-1.5" />
                <span className="@md:inline hidden">{t('buttons.resume')}</span>
              </Button>
              <Button
                variant="ghost"
                disabled={!canInteract}
                onClick={() => handleTorrentAction('pause')}
                className="hover:bg-orange/10 hover:text-orange text-orange/80"
              >
                <i className="i-mingcute-pause-fill mr-1.5" />
                <span className="@md:inline hidden">{t('buttons.pause')}</span>
              </Button>
              <Button
                variant="ghost"
                disabled={!canInteract}
                onClick={() => handleTorrentAction('delete')}
                className="hover:bg-red/10 hover:text-red text-red/80"
              >
                <i className="i-mingcute-delete-2-line mr-1.5" />
                <span className="@md:inline hidden">{t('buttons.delete')}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right section: Stats, Search, and Controls */}
      <div className="flex items-center gap-3 -mr-3">
        {/* Disk usage and speed indicators */}
        <SpeedIndicators variant="standard" showTotalData />

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          {showSearch && <TorrentSearchInput />}
          <Button
            variant="ghost"
            className="p-2"
            onClick={() => {
              Modal.present(DiscoverModal)
            }}
            title={t('buttons.discover')}
          >
            <i className="i-mingcute-safari-line text-lg" />
          </Button>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center">
          <Button
            variant="ghost"
            className="p-2"
            onClick={() => {
              presentSettingsModal({ tab: 'appearance' })
            }}
            title={t('buttons.settings')}
          >
            <i className="i-mingcute-settings-3-line text-lg" />
          </Button>

          <Button variant="ghost" className="p-2" onClick={toggleTheme}>
            <i
              className={cn(
                'text-lg',
                theme === 'system'
                  ? 'i-mingcute-computer-line'
                  : theme === 'dark'
                    ? 'i-mingcute-sun-line'
                    : 'i-mingcute-moon-line',
              )}
            />
          </Button>
        </div>
      </div>
    </header>
  )
}
