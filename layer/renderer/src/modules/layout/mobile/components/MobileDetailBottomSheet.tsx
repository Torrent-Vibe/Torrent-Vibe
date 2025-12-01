import { useAtomValue, useSetAtom } from 'jotai'
import { m } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

import { Spring } from '~/lib/spring'
import { DetailPanelContent } from '~/modules/detail/DetailPanelContent'
import { useTorrentTableStore } from '~/modules/torrent/stores/torrent-table-store'

import {
  closeDetailBottomSheetAtom,
  selectedCardAtom,
} from '../atoms/mobile-layout'
import type { BottomSheetComponent, BottomSheetComponentProps } from './types'
import { BottomSheet } from './UniversalBottomSheetManager'

interface MobileDetailContentProps extends BottomSheetComponentProps {
  // Add any additional props specific to mobile detail content
}

// Mobile-optimized wrapper for DetailPanelContent that integrates with UniversalBottomSheetManager
const MobileDetailContent: BottomSheetComponent<MobileDetailContentProps> = ({
  bottomSheetId: _bottomSheetId,
  dismiss,
}) => {
  const selectedCard = useAtomValue(selectedCardAtom)
  const setActiveTorrentHash = useTorrentTableStore(
    (state) => state.setActiveTorrentHash,
  )

  // Sync the torrent table store when card selection changes
  useEffect(() => {
    if (selectedCard) {
      setActiveTorrentHash(selectedCard)
    } else {
      setActiveTorrentHash(null)
    }
  }, [selectedCard, setActiveTorrentHash])

  // Effect to automatically close when no card is selected
  useEffect(() => {
    if (!selectedCard && dismiss) {
      dismiss()
    }
  }, [selectedCard, dismiss])

  if (!selectedCard) {
    return (
      <m.div
        className="flex-1 flex items-center justify-center p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={Spring.presets.smooth}
      >
        <div className="text-center text-text-secondary">
          <m.i
            className="i-mingcute-smartphone-4-line text-5xl mb-4 text-accent"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <p className="text-base font-medium">No torrent selected</p>
          <p className="text-sm text-placeholder-text mt-1">
            Select a torrent card to view details
          </p>
        </div>
      </m.div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col min-h-[80vh] max-h-[80vh]">
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-0">
        <DetailPanelContent />
      </div>
    </div>
  )
}

export const useMobileDetailBottomSheet = () => {
  const setSelectedCard = useSetAtom(selectedCardAtom)
  const closeDetailBottomSheet = useSetAtom(closeDetailBottomSheetAtom)
  const currentSheetId = useRef<string | null>(null)

  const openDetailSheet = useCallback(
    (torrentHash: string) => {
      // Update the selected card state
      setSelectedCard(torrentHash)

      // Present the bottom sheet using the new BottomSheet API
      if (currentSheetId.current) {
        BottomSheet.dismiss(currentSheetId.current)
      }

      currentSheetId.current = BottomSheet.present(
        MobileDetailContent,
        undefined, // No additional props needed
        {
          maxHeight: 'max-h-[85vh]',
          minHeight: 'min-h-[50vh]',
        },
      )
    },
    [setSelectedCard],
  )

  const closeDetailSheet = useCallback(() => {
    if (currentSheetId.current) {
      BottomSheet.dismiss(currentSheetId.current)
      currentSheetId.current = null
    }
    closeDetailBottomSheet()
  }, [closeDetailBottomSheet])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSheetId.current) {
        BottomSheet.dismiss(currentSheetId.current)
      }
    }
  }, [])

  return {
    openDetailSheet,
    closeDetailSheet,
  }
}
