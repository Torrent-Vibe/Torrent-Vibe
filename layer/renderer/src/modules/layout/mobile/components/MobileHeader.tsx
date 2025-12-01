import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Logo } from '~/components/app/logo'
import { Button } from '~/components/ui/button/Button'
import { Modal } from '~/components/ui/modal/ModalManager'
import { cn } from '~/lib/cn'
import { formatSpeedWithStatus } from '~/lib/format'
import { useGlobalSpeeds } from '~/modules/torrent/hooks/use-torrent-computed'

import { DiscoverModal } from '../../../modals/DiscoverModal'
import { drawerOpenAtom, searchExpandedAtom } from '../atoms/mobile-layout'
import { MobileSearchInput } from './MobileSearchInput'

interface MobileHeaderProps {
  className?: string
}

export const MobileHeader = ({ className }: MobileHeaderProps) => {
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useAtom(drawerOpenAtom)
  const [searchExpanded, setSearchExpanded] = useAtom(searchExpandedAtom)

  const { downloadSpeed, uploadSpeed } = useGlobalSpeeds()

  const handleToggleDrawer = useCallback(() => {
    setDrawerOpen(!drawerOpen)
  }, [drawerOpen, setDrawerOpen])

  const handleToggleSearch = useCallback(() => {
    setSearchExpanded(!searchExpanded)
  }, [searchExpanded, setSearchExpanded])

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-background border-b border-border',
        'flex flex-col drag-region',

        'macos:electron:pl-16',
        className,
      )}
    >
      {/* Main header bar - 48px height */}
      <div className="flex items-center justify-between h-12 px-2">
        {/* Left side - Hamburger menu */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="p-2"
            onClick={handleToggleDrawer}
            aria-label={t('mobile.nav.openMenu')}
          >
            <i
              className={cn(
                'text-lg transition-transform duration-200',
                drawerOpen
                  ? 'i-mingcute-close-line rotate-90'
                  : 'i-mingcute-dot-grid-line',
              )}
            />
          </Button>

          {/* Compact branding */}
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8" />
            <span className="text-base font-medium text-text">
              Torrent Vibe
            </span>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-1">
          {/* Speed indicators - compact */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 tabular-nums">
              <i className="i-mingcute-download-line text-blue text-xs" />
              <span
                className={cn(
                  'text-xs',
                  formatSpeedWithStatus(downloadSpeed).colorClass,
                )}
              >
                {formatSpeedWithStatus(downloadSpeed).text}
              </span>
            </div>
            <div className="flex items-center gap-1 tabular-nums">
              <i className="i-mingcute-upload-line text-green text-xs" />
              <span
                className={cn(
                  'text-xs',
                  formatSpeedWithStatus(uploadSpeed).colorClass,
                )}
              >
                {formatSpeedWithStatus(uploadSpeed).text}
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          <Button
            variant="ghost"
            className="p-2"
            onClick={() => Modal.present(DiscoverModal)}
            aria-label={t('buttons.discover')}
          >
            <i className="i-mingcute-safari-line text-base" />
          </Button>

          {/* Search toggle */}
          <Button
            variant="ghost"
            className={cn(
              'p-2 transition-colors',
              searchExpanded && 'bg-accent/10 text-accent',
            )}
            onClick={handleToggleSearch}
            aria-label={t('mobile.nav.toggleSearch')}
          >
            <i className="i-mingcute-search-line text-base" />
          </Button>
        </div>
      </div>

      {/* Expandable search bar */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          searchExpanded ? 'opacity-100 h-auto mb-4' : 'opacity-0 h-0',
        )}
      >
        <div className="px-4">{searchExpanded && <MobileSearchInput />}</div>
      </div>
    </header>
  )
}
