import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { formatBytesSmart } from '~/lib/format'
import type { MikanEpisodeExtra } from '~/modules/discover/providers/mikan/utils'
import { useCurrentServerId } from '~/modules/helper-client/hooks'
import { SubscriptionActions } from '~/modules/subscriptions'
import type { HelperStatusSnapshot } from '~/modules/subscriptions/store'

import { episodeStateLabelKey } from './episode-state'
import { episodeStateFor } from './subscription-view'

export const MikanEpisodeList = ({
  bangumiId,
  subgroupId,
  episodes,
  importing,
  onImport,
  statusByServer,
}: {
  bangumiId: string
  subgroupId: string | null
  episodes: MikanEpisodeExtra[]
  importing: boolean
  onImport: (episodeId: string) => void
  statusByServer: Record<string, HelperStatusSnapshot>
}) => {
  const { t } = useTranslation('app')
  const serverId = useCurrentServerId()

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-background">
      {episodes.map((episode) => {
        const state
          = bangumiId && subgroupId
            ? episodeStateFor(
                bangumiId,
                subgroupId,
                episode.episodeId,
                statusByServer,
              )
            : null
        return (
          <li
            key={episode.episodeId}
            className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">{episode.title}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-secondary">
                <span>
                  {episode.sizeBytes
                    ? formatBytesSmart(episode.sizeBytes)
                    : '—'}
                </span>
                <span>{episode.publishedAt || '—'}</span>
                {state && <span>{t(episodeStateLabelKey(state))}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {(state === 'failed' || state === 'needs-manual') && serverId && (
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
              <Button
                size="sm"
                disabled={importing}
                onClick={() => onImport(episode.episodeId)}
              >
                {importing && (
                  <i className="i-mingcute-loading-3-line mr-1 animate-spin" />
                )}
                {t('discover.modal.mikan.importEpisode')}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
