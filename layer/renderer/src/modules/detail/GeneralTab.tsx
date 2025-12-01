import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { PieceBarCanvas } from '~/components/ui/piece-bar'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { cn } from '~/lib/cn'
import {
  formatBytes,
  formatDateTime,
  formatEta,
  formatSpeed,
} from '~/lib/format'
import { Spring } from '~/lib/spring'
import {
  SettingField,
  SettingSectionCard,
} from '~/modules/modals/SettingsModal/tabs/components'
import { getStatusColor, getStatusConfig } from '~/modules/torrent/utils/status'
import type { TorrentInfo, TorrentProperties } from '~/types/torrent'

interface GeneralTabProps {
  torrent: TorrentInfo
  properties?: TorrentProperties
  pieceStates?: number[]
}

// status color moved to shared util

export const GeneralTab = ({
  torrent,
  properties,
  pieceStates,
}: GeneralTabProps) => {
  const { t } = useTranslation()
  return (
    <ScrollArea flex viewportClassName="px-4 pt-4 pb-4 @container">
      <div className="space-y-6">
        {/* Progress */}
        <SettingSectionCard title={t('detail.progress')}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-secondary">
                {t('detail.progress')}
              </span>
              <span className="text-sm font-bold text-text">
                {(torrent.progress * 100).toFixed(1)}%
              </span>
            </div>
            <div className="relative h-2 bg-fill-tertiary rounded-full overflow-hidden">
              <m.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent to-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${torrent.progress * 100}%` }}
                transition={Spring.presets.smooth}
              />
            </div>
            <div>
              <div className="text-xs pl-1.5 text-text-secondary mb-1.5">
                {t('detail.pieces')}
              </div>
              <div className="rounded-sm border border-separator/50 p-1">
                <PieceBarCanvas
                  totalPieces={properties?.pieces_num}
                  havePieces={properties?.pieces_have}
                  states={pieceStates}
                  height={8}
                  progress={torrent.progress}
                />
              </div>
            </div>
          </div>
        </SettingSectionCard>

        {/* Overview */}
        <div className="grid grid-cols-1 gap-6 @[900px]:grid-cols-2">
          <SettingSectionCard title={t('detail.overview')}>
            <div className="space-y-2">
              <SettingField label={t('detail.status')}>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    getStatusColor(torrent.state),
                  )}
                >
                  {t(getStatusConfig(torrent.state).label)}
                </span>
              </SettingField>
              <SettingField label={t('detail.size')}>
                <span className="text-sm font-semibold text-text">
                  {formatBytes(torrent.size)}
                </span>
              </SettingField>
              <SettingField label={t('detail.ratio')}>
                <span className="text-sm font-semibold text-text">
                  {torrent.ratio.toFixed(2)}
                </span>
              </SettingField>
              <SettingField label={t('detail.eta')}>
                <span className="text-sm font-semibold text-text">
                  {formatEta(torrent.eta)}
                </span>
              </SettingField>
            </div>
          </SettingSectionCard>

          <SettingSectionCard title={t('detail.activity')}>
            <div className="space-y-2">
              <SettingField label={t('detail.download')}>
                <span className="text-sm font-semibold text-blue">
                  {formatSpeed(torrent.dlspeed)}
                </span>
              </SettingField>
              <SettingField label={t('detail.upload')}>
                <span className="text-sm font-semibold text-green">
                  {formatSpeed(torrent.upspeed)}
                </span>
              </SettingField>
              <SettingField label={t('detail.seeds')}>
                <span className="text-sm font-semibold text-text">
                  {torrent.num_seeds} ({torrent.num_complete})
                </span>
              </SettingField>
              <SettingField label={t('detail.peers')}>
                <span className="text-sm font-semibold text-text">
                  {torrent.num_leechs} ({torrent.num_incomplete})
                </span>
              </SettingField>
            </div>
          </SettingSectionCard>
        </div>

        {/* Detailed properties */}
        <div className="grid grid-cols-1 gap-6 @[900px]:grid-cols-2">
          <SettingSectionCard title={t('detail.information')}>
            <div className="space-y-2">
              <SettingField label={t('detail.savePath')}>
                <span className="text-xs font-medium text-text break-all text-right">
                  {properties?.save_path ?? '—'}
                </span>
              </SettingField>
              <SettingField label={t('detail.added')}>
                <span className="text-xs font-medium text-text">
                  {formatDateTime(properties?.addition_date)}
                </span>
              </SettingField>
              <SettingField label={t('detail.completed')}>
                <span className="text-xs font-medium text-text">
                  {formatDateTime(properties?.completion_date)}
                </span>
              </SettingField>
              <SettingField label={t('detail.lastSeen')}>
                <span className="text-xs font-medium text-text">
                  {formatDateTime(properties?.last_seen)}
                </span>
              </SettingField>
              <SettingField label={t('detail.timeActive')}>
                <span className="text-xs font-medium text-text">
                  {(properties?.time_elapsed ?? 0) > 0
                    ? `${Math.floor((properties!.time_elapsed as number) / 3600)}h`
                    : '—'}
                </span>
              </SettingField>
            </div>
          </SettingSectionCard>

          <SettingSectionCard title={t('detail.hashesAndPieces')}>
            <div className="space-y-2">
              <SettingField label={t('detail.infohashV1')}>
                <span className="text-xs font-mono font-medium text-text break-all text-right">
                  {properties?.infohash_v1 ?? '—'}
                </span>
              </SettingField>
              <SettingField label={t('detail.infohashV2')}>
                <span className="text-xs font-mono font-medium text-text break-all text-right">
                  {properties?.infohash_v2 ?? '—'}
                </span>
              </SettingField>
              <SettingField label={t('detail.pieceSize')}>
                <span className="text-xs font-medium text-text">
                  {formatBytes(properties?.piece_size ?? 0)}
                </span>
              </SettingField>
              <SettingField label={t('detail.pieces')}>
                <span className="text-xs font-medium text-text">
                  {properties
                    ? `${properties.pieces_have}/${properties.pieces_num}`
                    : '—'}
                </span>
              </SettingField>
            </div>
          </SettingSectionCard>

          <SettingSectionCard title={t('detail.limitsAndConnections')}>
            <div className="space-y-2">
              <SettingField label={t('detail.dlLimit')}>
                <span className="text-xs font-medium text-text">
                  {typeof properties?.dl_limit === 'number' &&
                  (properties!.dl_limit as number) > 0
                    ? `${formatBytes(properties!.dl_limit as number)}/s`
                    : t('detail.unlimited')}
                </span>
              </SettingField>
              <SettingField label={t('detail.ulLimit')}>
                <span className="text-xs font-medium text-text">
                  {typeof properties?.up_limit === 'number' &&
                  (properties!.up_limit as number) > 0
                    ? `${formatBytes(properties!.up_limit as number)}/s`
                    : t('detail.unlimited')}
                </span>
              </SettingField>
              <SettingField label={t('detail.connections')}>
                <span className="text-xs font-medium text-text">
                  {properties
                    ? `${properties.nb_connections}/${(properties.nb_connections_limit ?? 0) < 0 ? '∞' : properties.nb_connections_limit}`
                    : '—'}
                </span>
              </SettingField>
              <SettingField label={t('detail.shareRatio')}>
                <span className="text-xs font-medium text-text">
                  {properties?.share_ratio?.toFixed?.(2) ??
                    torrent.ratio.toFixed(2)}
                </span>
              </SettingField>
            </div>
          </SettingSectionCard>

          <SettingSectionCard title={t('detail.metadata')}>
            <div className="space-y-2">
              <SettingField label={t('detail.createdBy')}>
                <span className="text-xs font-medium text-text">
                  {properties?.created_by || '—'}
                </span>
              </SettingField>
              <SettingField label={t('detail.creationDate')}>
                <span className="text-xs font-medium text-text">
                  {formatDateTime(properties?.creation_date)}
                </span>
              </SettingField>
              <SettingField label={t('detail.comment')}>
                <span className="text-xs font-medium text-text break-all text-right max-w-[70%]">
                  {properties?.comment || '—'}
                </span>
              </SettingField>
            </div>
          </SettingSectionCard>
        </div>
      </div>
    </ScrollArea>
  )
}
