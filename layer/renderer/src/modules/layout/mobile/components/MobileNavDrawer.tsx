import { useAtom } from 'jotai'
import { m } from 'motion/react'
import { useCallback } from 'react'
import { Drawer } from 'vaul'

import { Button } from '~/components/ui/button/Button'
import { Modal } from '~/components/ui/modal/ModalManager'
// Separator replacement - using div instead
import {
  useIsDark,
  useSetTheme,
  useThemeAtomValue,
} from '~/hooks/common/useDark'
import { getI18n } from '~/i18n'
import { cn } from '~/lib/cn'
import { formatBytes, formatSpeedWithStatus } from '~/lib/format'
import { Spring } from '~/lib/spring'
import { AddTorrentModal } from '~/modules/modals/AddTorrentModal'
import { presentSettingsModal } from '~/modules/modals/SettingsModal'
import {
  useGlobalSpeeds,
  useGlobalTotalData,
  useHasSelection,
} from '~/modules/torrent/hooks/use-torrent-computed'
import { useTorrentDataStore } from '~/modules/torrent/stores'
import { TorrentActions } from '~/modules/torrent/stores/torrent-actions'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

import { drawerOpenAtom } from '../atoms/mobile-layout'
import { useMobileSelectionToolbar } from '../hooks/useMobileSelection'

interface MobileNavDrawerProps {
  className?: string
}

export const MobileNavDrawer = ({ className }: MobileNavDrawerProps) => {
  const [drawerOpen, setDrawerOpen] = useAtom(drawerOpenAtom)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setDrawerOpen(open)
    },
    [setDrawerOpen],
  )

  return (
    <Drawer.Root
      open={drawerOpen}
      onOpenChange={handleOpenChange}
      direction="left"
      modal={true}
    >
      <Drawer.Portal>
        {/* Overlay */}
        <Drawer.Overlay
          className={cn(
            'fixed inset-0 bg-black/40 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
            'z-40',
          )}
        />

        {/* Drawer Content */}
        <Drawer.Content
          className={cn(
            'bg-background flex flex-col fixed top-0 left-0 bottom-0 z-50',
            'w-80 max-w-[85vw] border-r border-border',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-left-0',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left-0',
            className,
          )}
        >
          <MobileNavDrawerContent />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

const MobileNavDrawerContent = () => {
  const theme = useThemeAtomValue()
  const setTheme = useSetTheme()
  const isDark = useIsDark()
  const { downloadSpeed, uploadSpeed } = useGlobalSpeeds()
  const { totalDownloaded, totalUploaded, freeSpaceOnDisk } =
    useGlobalTotalData()
  const hasSelection = useHasSelection()
  const activeTorrentHash = useTorrentTableSelectors.useActiveTorrentHash()
  const { showToolbar, toolbarActions, exitMultiSelectMode, selectionSummary } =
    useMobileSelectionToolbar()

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
      console.error(`${getI18n().t('messages.torrentsAddFailed')}:`, error)
    }
  }

  const toggleTheme = useCallback(() => {
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
  }, [theme, isDark, setTheme])

  return (
    <div className="flex flex-col h-full macos:electron:pt-6">
      {/* Header */}
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <i className="i-mingcute-download-line text-white text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text">Torrent Vibe</h1>
            <p className="text-sm text-text-secondary">Mobile WebUI</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-material-ultra-thin rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <i className="i-mingcute-download-line text-blue text-sm" />
              <span className="text-text-secondary">Download</span>
            </div>
            <div
              className={cn(
                'font-mono text-sm',
                formatSpeedWithStatus(downloadSpeed).colorClass,
              )}
            >
              {formatSpeedWithStatus(downloadSpeed).text}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {formatBytes(totalDownloaded)}
            </div>
          </div>

          <div className="bg-material-ultra-thin rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <i className="i-mingcute-upload-line text-green text-sm" />
              <span className="text-text-secondary">Upload</span>
            </div>
            <div
              className={cn(
                'font-mono text-sm',
                formatSpeedWithStatus(uploadSpeed).colorClass,
              )}
            >
              {formatSpeedWithStatus(uploadSpeed).text}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {formatBytes(totalUploaded)}
            </div>
          </div>
        </div>

        <div className="mt-3 bg-material-ultra-thin rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <i className="i-mingcute-usb-flash-disk-line text-blue text-sm" />
            <span className="text-text-secondary text-sm">Free Space</span>
          </div>
          <div className="font-mono text-sm text-text">
            {formatBytes(freeSpaceOnDisk)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Primary Actions */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
              Actions
            </h2>

            <Button
              variant="primary"
              className="w-full justify-start"
              onClick={() => {
                Modal.present(AddTorrentModal)
              }}
            >
              <i className="i-mingcute-add-line mr-3 text-lg" />
              Add Torrent
            </Button>
          </div>

          {/* Selection Toolbar */}
          {showToolbar && (
            <m.div
              className="space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={Spring.presets.smooth}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
                  Selection
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exitMultiSelectMode}
                  className="text-text-tertiary hover:text-text-secondary"
                >
                  <i className="i-mingcute-close-line mr-1" />
                  Cancel
                </Button>
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-3">
                <p className="text-sm text-accent font-medium">
                  {selectionSummary}
                </p>
              </div>

              <div className="space-y-2">
                {toolbarActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="ghost"
                    className={cn(
                      'w-full justify-start',
                      `hover:bg-${action.color.replace('text-', '')}/10`,
                    )}
                    onClick={action.action}
                  >
                    <i
                      className={cn(action.icon, action.color, 'mr-3 text-lg')}
                    />
                    {action.label}
                  </Button>
                ))}
              </div>
            </m.div>
          )}

          {/* Torrent Controls */}
          {!showToolbar && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
                Controls
              </h2>

              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="ghost"
                  disabled={!canInteract}
                  onClick={() => handleTorrentAction('resume')}
                  className={cn(
                    'justify-start',
                    canInteract
                      ? 'hover:bg-green/10 hover:text-green text-green/80'
                      : 'text-text-tertiary',
                  )}
                >
                  <i className="i-mingcute-play-fill mr-3 text-lg" />
                  Resume
                </Button>

                <Button
                  variant="ghost"
                  disabled={!canInteract}
                  onClick={() => handleTorrentAction('pause')}
                  className={cn(
                    'justify-start',
                    canInteract
                      ? 'hover:bg-orange/10 hover:text-orange text-orange/80'
                      : 'text-text-tertiary',
                  )}
                >
                  <i className="i-mingcute-pause-fill mr-3 text-lg" />
                  Pause
                </Button>

                <Button
                  variant="ghost"
                  disabled={!canInteract}
                  onClick={() => handleTorrentAction('delete')}
                  className={cn(
                    'justify-start',
                    canInteract
                      ? 'hover:bg-red/10 hover:text-red text-red/80'
                      : 'text-text-tertiary',
                  )}
                >
                  <i className="i-mingcute-delete-2-line mr-3 text-lg" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          <div className="h-px bg-border mx-6 my-4" />

          {/* Settings & Preferences */}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
              Settings
            </h2>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                presentSettingsModal({ tab: 'appearance' })
              }}
            >
              <i className="i-mingcute-settings-3-line mr-3 text-lg" />
              Settings
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={toggleTheme}
            >
              <i
                className={cn(
                  'mr-3 text-lg',
                  theme === 'system'
                    ? 'i-mingcute-computer-line'
                    : theme === 'dark'
                      ? 'i-mingcute-sun-line'
                      : 'i-mingcute-moon-line',
                )}
              />
              Theme:{' '}
              {theme === 'system'
                ? 'System'
                : theme === 'dark'
                  ? 'Dark'
                  : 'Light'}
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-border">
        <div className="text-center">
          <p className="text-xs text-text-tertiary">Torrent Vibe Mobile</p>
          <p className="text-xs text-text-tertiary mt-1">Version 4.x.x</p>
        </div>
      </div>
    </div>
  )
}
