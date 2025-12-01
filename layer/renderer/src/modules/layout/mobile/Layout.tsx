import { useAtomValue } from 'jotai'

import { dragDropStateAtom } from '~/atoms/drag-drop'
import { DragOverlay } from '~/components/ui/drag-overlay'
import { usePrefetchTorrents } from '~/modules/torrent/hooks/use-prefetch-data'

import { searchExpandedAtom } from './atoms/mobile-layout'
import { MobileExpandableFloatingActionButton } from './components/MobileFloatingActionButton'
import { MobileHeader } from './components/MobileHeader'
import { MobileNavDrawer } from './components/MobileNavDrawer'
import { MobileToolbar } from './components/MobileToolbar'
import { MobileTorrentList } from './components/MobileTorrentList'
import { UniversalBottomSheetContainer } from './components/UniversalBottomSheetContainer'
import { MOBILE_LAYOUT_CONSTANTS } from './constants'

const PrefetchTorrents = () => {
  usePrefetchTorrents()
  return null
}

export const Layout = () => {
  const dragDropState = useAtomValue(dragDropStateAtom)
  const searchExpanded = useAtomValue(searchExpandedAtom)

  return (
    <div className="h-screen flex flex-col bg-background text-text overflow-hidden">
      <PrefetchTorrents />

      {/* Fixed Mobile Header */}
      <MobileHeader />

      {/* Main content with proper top offset */}
      <div
        className="flex-1 flex flex-col overflow-hidden duration-200"
        style={{
          paddingTop: searchExpanded
            ? `${MOBILE_LAYOUT_CONSTANTS.HEADER_HEIGHT_EXPANDED}px`
            : `${MOBILE_LAYOUT_CONSTANTS.HEADER_HEIGHT}px`,
        }}
      >
        <MainContent />
      </div>

      {/* Detail Panel Integration - will be implemented in next task */}
      <DetailPanelConditionRender />

      {/* Navigation Drawer */}
      <NavigationDrawerConditionRender />

      {/* Universal Bottom Sheets */}
      <UniversalBottomSheetContainer />

      {/* Floating Action Button */}
      <MobileExpandableFloatingActionButton hideOnMultiSelect={false} />

      {/* Drag overlay for file uploads */}
      <DragOverlay
        isVisible={dragDropState.isDragging && dragDropState.hasValidFiles}
        isDragOver={dragDropState.isDragOver}
      />
    </div>
  )
}

const MainContent = () => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mobile Toolbar */}
      <MobileToolbar />

      {/* Mobile Torrent List */}
      <MobileTorrentList />
    </div>
  )
}

// Mobile detail panel is now handled by UniversalBottomSheetContainer
const DetailPanelConditionRender = () => {
  return null
}

// Mobile navigation drawer using Vaul
const NavigationDrawerConditionRender = () => {
  return <MobileNavDrawer />
}
