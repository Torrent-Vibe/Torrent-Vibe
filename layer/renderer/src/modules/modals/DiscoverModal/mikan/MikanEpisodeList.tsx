import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { Button } from '~/components/ui/button'
import { cn } from '~/lib/cn'
import { formatBytesSmart } from '~/lib/format'
import type { MikanEpisodeExtra } from '~/modules/discover/providers/mikan/utils'
import { useCurrentServerId } from '~/modules/helper-client/hooks'
import { SubscriptionActions } from '~/modules/subscriptions'
import { episodeStatusFor } from '~/modules/subscriptions/selectors'
import type { HelperStatusSnapshot } from '~/modules/subscriptions/store'
import { useTorrentSelection } from '~/modules/torrent/hooks/use-torrent-selection'
import { useTorrentDataStore } from '~/modules/torrent/stores'
import { selectTorrentsByHash } from '~/modules/torrent/stores/torrent-selectors'

import { EPISODE_BADGE_TONE_CLASS } from './episode-badge'
import { buildTorrentHashIndex } from './episode-live-progress'
import { buildEpisodeRowModel } from './episode-row-model'

export const MikanEpisodeList = ({
  bangumiId,
  subgroupId,
  episodes,
  importing,
  onImport,
  statusByServer,
  subscribed,
  targetServerIds,
}: {
  bangumiId: string
  subgroupId: string | null
  episodes: MikanEpisodeExtra[]
  importing: boolean
  onImport: (episodeId: string) => void
  statusByServer: Record<string, HelperStatusSnapshot>
  subscribed: boolean
  targetServerIds: string[]
}) => {
  const { t } = useTranslation('app')
  const serverId = useCurrentServerId()
  const navigate = useNavigate()
  const { selectAndShowDetail } = useTorrentSelection()
  const torrentsByHash = useTorrentDataStore(selectTorrentsByHash)
  const torrentIndex = useMemo(
    () => buildTorrentHashIndex(torrentsByHash),
    [torrentsByHash],
  )

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-background">
      {episodes.map((episode) => {
        const status =
          bangumiId && subgroupId
            ? episodeStatusFor(
                targetServerIds,
                bangumiId,
                subgroupId,
                episode.episodeId,
                statusByServer,
              )
            : null
        const model = buildEpisodeRowModel({
          infohash: status?.infohash,
          state: status?.state ?? null,
          subscribed,
          torrentIndex,
        })
        const jumpToTorrent = () => {
          if (!model.torrentHash) {
            return
          }
          selectAndShowDetail(model.torrentHash)
          navigate('/')
        }
        return (
          <li
            className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
            key={episode.episodeId}
          >
            {model.badge && (
              <button
                disabled={!model.torrentHash}
                type="button"
                className={cn(
                  'inline-flex h-5 shrink-0 items-center gap-1 self-start rounded-full border px-1.5 text-[10px] font-medium leading-none sm:self-center',
                  model.torrentHash && 'transition hover:opacity-80',
                  EPISODE_BADGE_TONE_CLASS[model.badge.tone],
                )}
                onClick={jumpToTorrent}
              >
                <i className={cn(model.badge.icon, 'text-[11px]')} />
                <span>{t(model.badge.labelKey)}</span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">{episode.title}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-secondary">
                <span>
                  {episode.sizeBytes
                    ? formatBytesSmart(episode.sizeBytes)
                    : '—'}
                </span>
                <span>{episode.publishedAt || '—'}</span>
                {model.liveProgress && (
                  <span>{model.liveProgress.displayText}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {model.showRetry && serverId && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void SubscriptionActions.shared.retryEpisode({
                      serverId,
                      bangumiId,
                      subgroupId: subgroupId ?? '',
                      episodeId: episode.episodeId,
                      title: episode.title,
                      torrentUrl: episode.torrentUrl,
                    })
                  }}
                >
                  {t('discover.modal.mikan.retryEpisode')}
                </Button>
              )}
              {model.actionLabelKey && (
                <Button
                  disabled={importing}
                  size="sm"
                  onClick={() => onImport(episode.episodeId)}
                >
                  {importing && (
                    <i className="i-mingcute-loading-3-line mr-1 animate-spin" />
                  )}
                  {t(model.actionLabelKey)}
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
