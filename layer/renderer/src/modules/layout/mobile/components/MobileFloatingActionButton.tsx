import { useAtomValue } from 'jotai'
import { AnimatePresence, m } from 'motion/react'
import { useCallback, useState } from 'react'

import { Button } from '~/components/ui/button/Button'
import { Modal } from '~/components/ui/modal/ModalManager'
import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'
import { AddTorrentModal } from '~/modules/modals/AddTorrentModal'

import { multiSelectModeAtom } from '../atoms/mobile-layout'
import {
  useMobileSelection,
  useMobileTorrentActions,
} from '../hooks/useMobileSelection'

interface MobileFloatingActionButtonProps {
  className?: string
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  offset?: { x: number; y: number }
  hideOnMultiSelect?: boolean
  hideOnScroll?: boolean
}

const defaultOffset = { x: 24, y: 24 }

// Extended FAB with multiple actions (expandable)
export const MobileExpandableFloatingActionButton = ({
  className,
  position = 'bottom-right',
  offset = defaultOffset,
  hideOnMultiSelect = true,
}: MobileFloatingActionButtonProps) => {
  const multiSelectMode = useAtomValue(multiSelectModeAtom)
  const { exitMultiSelectMode } = useMobileSelection()
  const { resumeSelectedTorrents, pauseSelectedTorrents } =
    useMobileTorrentActions()
  const [isExpanded, setIsExpanded] = useState(false)

  const shouldShow = !(hideOnMultiSelect && multiSelectMode)

  const handleToggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded)
  }, [isExpanded])

  const handleAddTorrent = useCallback(() => {
    Modal.present(AddTorrentModal)
    setIsExpanded(false)
  }, [])

  // Define action buttons
  const actions = multiSelectMode
    ? [
        {
          icon: 'i-mingcute-play-fill',
          label: 'Resume Selected',
          color: 'bg-green hover:bg-green/90',
          action: () => {
            resumeSelectedTorrents()
            setIsExpanded(false)
          },
        },
        {
          icon: 'i-mingcute-pause-fill',
          label: 'Pause Selected',
          color: 'bg-orange hover:bg-orange/90',
          action: () => {
            pauseSelectedTorrents()
            setIsExpanded(false)
          },
        },
        {
          icon: 'i-mingcute-close-line',
          label: 'Exit Selection',
          color: 'bg-material-medium hover:bg-material-thick',
          action: () => {
            exitMultiSelectMode()
            setIsExpanded(false)
          },
        },
      ]
    : [
        {
          icon: 'i-mingcute-add-line',
          label: 'Add Torrent',
          color: 'bg-accent hover:bg-accent/90',
          action: handleAddTorrent,
        },
      ]

  const positionClasses = {
    'bottom-right': 'bottom-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
  }

  const positionStyles = {
    marginRight: position === 'bottom-right' ? `${offset.x}px` : undefined,
    marginLeft: position === 'bottom-left' ? `${offset.x}px` : undefined,
    marginBottom: `${offset.y}px`,
  }

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <m.div
          className={cn(
            'fixed z-30 flex flex-col items-end gap-3',
            positionClasses[position],
            position === 'bottom-left' && 'items-start',
            position === 'bottom-center' && 'items-center',
            className,
          )}
          style={positionStyles}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={Spring.presets.bouncy}
        >
          {/* Action buttons */}
          <AnimatePresence>
            {isExpanded && (
              <m.div
                className="flex flex-col gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={Spring.presets.smooth}
              >
                {actions.map((action, index) => (
                  <m.div
                    key={action.label}
                    initial={{ opacity: 0, scale: 0, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{
                      ...Spring.presets.bouncy,
                      delay: index * 0.05,
                    }}
                    className="flex items-center gap-3"
                  >
                    {/* Label */}
                    <div
                      className={cn(
                        'bg-material-opaque border border-border rounded-lg px-3 py-2',
                        'shadow-lg whitespace-nowrap text-sm font-medium text-text',
                        position === 'bottom-left' && 'order-2',
                      )}
                    >
                      {action.label}
                    </div>

                    {/* Action button */}
                    <Button
                      className={cn(
                        'h-12 w-12 rounded-full shadow-lg border-2 border-white/10',
                        action.color,
                        position === 'bottom-left' && 'order-1',
                      )}
                      onClick={action.action}
                    >
                      <i className={cn(action.icon, 'text-xl text-white')} />
                    </Button>
                  </m.div>
                ))}
              </m.div>
            )}
          </AnimatePresence>

          {/* Main FAB */}
          <Button
            variant="primary"
            className={cn(
              'h-14 w-14 rounded-full shadow-lg',
              'bg-accent hover:bg-accent/90 border-2 border-accent-foreground/10',
              'transition-all duration-200',
            )}
            onClick={handleToggleExpand}
            aria-label={isExpanded ? 'Close actions' : 'Open actions'}
            aria-expanded={isExpanded}
          >
            <i
              className={cn(
                'text-2xl text-white transition-transform duration-200',
                'i-mingcute-add-line',
                isExpanded && 'rotate-45',
              )}
            />
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  )
}
