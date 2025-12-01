import { m } from 'motion/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SegmentTab } from '~/components/ui/segment-tab'
import { formatBytes } from '~/lib/format'
import { Spring } from '~/lib/spring'
import { useActiveTorrent } from '~/modules/torrent/hooks/use-torrent-computed'
import { useTorrentDetails } from '~/modules/torrent/hooks/use-torrent-details'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

import { FilesTab } from './FilesTab'
import { GeneralTab } from './GeneralTab'
import { PeersTab } from './PeersTab'
import { TrackersTab } from './TrackersTab'

export const DetailPanelContent = () => {
  const { t } = useTranslation()
  const activeTorrent = useActiveTorrent()
  const activeTorrentHash = useTorrentTableSelectors.useActiveTorrentHash()
  const torrentDetails = useTorrentDetails(activeTorrentHash)

  const [activeTab, setActiveTab] = useState<
    'general' | 'files' | 'peers' | 'trackers'
  >('general')

  if (!activeTorrent) {
    return (
      <m.div
        className="flex-1 flex items-center justify-center p-8 z-[-1] absolute inset-0"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={Spring.presets.smooth}
      >
        <div className="text-center text-text-secondary">
          <m.i
            className="i-mingcute-file-line text-5xl mb-4 text-accent"
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
          <p className="text-base font-medium">
            Select a torrent to view details
          </p>
          <p className="text-sm text-placeholder-text mt-1">
            Choose any torrent from the list to see its information
          </p>
        </div>
      </m.div>
    )
  }

  // Detail-specific helpers moved into tab components

  return (
    <m.div
      className="flex flex-col h-full flex-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={Spring.presets.smooth}
    >
      {/* Torrent info header */}
      <div className="p-6 bg-fill-secondary/30 border-b border-separator backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-xl flex items-center justify-center bg-accent/10 border border-accent/20">
            <i className="i-mingcute-file-line text-accent text-2xl" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-lg text-text truncate leading-tight"
              title={activeTorrent.name}
            >
              {activeTorrent.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-1 text-xs font-medium bg-material-thin rounded-md text-text-secondary">
                {activeTorrent.category || t('detail.uncategorized')}
              </span>
              <span className="text-sm text-placeholder-text">•</span>
              <span className="text-sm font-medium text-text-secondary">
                {formatBytes(activeTorrent.size)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-separator">
        <div className="px-2 py-2 @container">
          <SegmentTab
            value={activeTab}
            onChange={(value) => setActiveTab(value as typeof activeTab)}
            items={[
              {
                value: 'general' as const,
                label: t('detail.general'),
                icon: <i className="i-mingcute-information-line" />,
              },
              {
                value: 'files' as const,
                label: (
                  <div className="flex items-center gap-2">
                    {t('detail.tabs.files')}
                  </div>
                ),
                icon: <i className="i-mingcute-folder-line" />,
              },
              {
                value: 'peers' as const,
                label: (
                  <div className="flex items-center gap-2">
                    {t('detail.tabs.peers')}
                  </div>
                ),
                icon: <i className="i-mingcute-group-line" />,
              },
              {
                value: 'trackers' as const,
                label: (
                  <div className="flex items-center gap-2">
                    {t('detail.tabs.trackers')}
                  </div>
                ),
                icon: <i className="i-mingcute-radar-line" />,
              },
            ]}
            containerClassName="w-full @[0px]:p-0"
            size="md"
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-hidden flex flex-col min-h-0 min-w-0">
        {activeTab === 'general' && (
          <GeneralTab
            torrent={activeTorrent}
            properties={torrentDetails.properties}
            pieceStates={torrentDetails.pieceStates}
          />
        )}

        {activeTab === 'files' && (
          <div className="p-4 flex flex-col flex-1 min-h-0 min-w-0">
            <FilesTab
              files={torrentDetails.files}
              torrentHash={activeTorrentHash!}
              torrent={activeTorrent}
              isLoading={torrentDetails.isFilesLoading}
            />
          </div>
        )}

        {activeTab === 'peers' && (
          <div className="p-4 flex flex-col flex-1 min-h-0 min-w-0">
            <PeersTab
              peers={torrentDetails.peers?.peers}
              isLoading={torrentDetails.isPeersLoading}
            />
          </div>
        )}

        {activeTab === 'trackers' && (
          <div className="p-4 flex flex-col flex-1 min-h-0 min-w-0">
            <TrackersTab
              trackers={torrentDetails.trackers}
              isLoading={torrentDetails.isTrackersLoading}
            />
          </div>
        )}
      </div>
    </m.div>
  )
}
