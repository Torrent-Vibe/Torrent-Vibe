import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { SegmentTab } from '~/components/ui/segment-tab'

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import { DiscoverEmptyState } from '../components'
import { useDiscoverModalStore } from '../store'
import { MikanBangumiPage } from './MikanBangumiPage'
import { MikanSearchResults } from './MikanSearchResults'
import { MikanSeasonWall } from './MikanSeasonWall'

export const MikanDiscoverShell = () => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { search, mikan } = actions.slices

  const providerReady = useDiscoverModalStore(state => state.providerReady)
  const keyword = useDiscoverModalStore(state => state.keyword)
  const year = useDiscoverModalStore(state => state.filters.year)
  const season = useDiscoverModalStore(state => state.filters.season)
  const committedSearch = useDiscoverModalStore(
    state => state.committedSearch,
  )
  const items = useDiscoverModalStore(state => state.items)
  const isSearching = useDiscoverModalStore(state => state.isSearching)
  const searchError = useDiscoverModalStore(state => state.searchError)
  const mikanTab = useDiscoverModalStore(state => state.mikanTab)
  const bangumiId = useDiscoverModalStore(state => state.mikanBangumiId)

  const seasonKey = `${String(year ?? '')}:${String(season ?? '')}`
  const previousKeywordRef = useRef(keyword)
  const previousSeasonKeyRef = useRef(seasonKey)

  useEffect(() => {
    if (previousKeywordRef.current === keyword) {
      return
    }
    previousKeywordRef.current = keyword
    if (bangumiId) {
      mikan.closeBangumi()
    }
  }, [bangumiId, keyword, mikan])

  useEffect(() => {
    if (!providerReady) {
      return
    }

    const seasonChanged = previousSeasonKeyRef.current !== seasonKey
    previousSeasonKeyRef.current = seasonKey
    if (seasonChanged && keyword.trim()) {
      return
    }

    const delay = keyword.trim() ? 350 : 0
    const timer = window.setTimeout(() => {
      void search.performSearch()
    }, delay)

    return () => window.clearTimeout(timer)
  }, [keyword, providerReady, search, seasonKey])

  const tabs = useMemo(
    () => [
      {
        value: 'season' as const,
        label: t('discover.modal.mikan.tabSeason'),
      },
      {
        value: 'subscriptions' as const,
        label: t('discover.modal.mikan.tabSubscriptions', { count: 0 }),
      },
    ],
    [t],
  )

  const showSearchResults = Boolean(committedSearch?.keyword.trim())

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background-secondary/30">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background/60 px-4 py-2.5">
        <div className="w-full max-w-md">
          <SegmentTab
            size="sm"
            variant="compact"
            items={tabs}
            value={mikanTab}
            onChange={mikan.setMikanTab}
          />
        </div>
        {isSearching && (
          <i className="i-mingcute-loading-3-line animate-spin text-text-tertiary" />
        )}
      </div>

      <ScrollArea rootClassName="flex-1 h-0" viewportClassName="bg-background">
        {!providerReady && (
          <DiscoverEmptyState
            icon="i-mingcute-settings-4-line"
            title={t('discover.modal.noProviderTitle')}
            description={t('discover.modal.noProviderDescription')}
            actionLabel={t('discover.modal.configureProviders')}
            onAction={() => presentSettingsModal({ tab: 'discover' })}
          />
        )}

        {providerReady && mikanTab === 'subscriptions' && (
          <DiscoverEmptyState
            icon="i-mingcute-notify-line"
            title={t('discover.modal.mikan.subscriptionsTitle')}
            description={t('discover.modal.mikan.subscriptionsDescription')}
          />
        )}

        {providerReady && mikanTab === 'season' && bangumiId && (
          <MikanBangumiPage />
        )}

        {providerReady && mikanTab === 'season' && !bangumiId && (
          <>
            {isSearching && items.length === 0 && (
              <div className="flex items-center justify-center gap-1.5 py-10 text-text-tertiary">
                <i className="i-mingcute-loading-3-line animate-spin text-lg" />
                <span>{t('discover.modal.loading')}</span>
              </div>
            )}

            {searchError && items.length === 0 && !isSearching && (
              <DiscoverEmptyState
                icon="i-mingcute-warning-line"
                title={t('discover.messages.searchFailed')}
                description={t('discover.modal.mikan.emptyWallDescription')}
                actionLabel={t('discover.modal.mikan.retry')}
                onAction={() => {
                  void search.performSearch()
                }}
              />
            )}

            {!isSearching && !searchError && items.length === 0 && (
              <DiscoverEmptyState
                icon="i-mingcute-search-2-line"
                title={
                  showSearchResults
                    ? t('discover.modal.mikan.emptySearchTitle')
                    : t('discover.modal.mikan.emptyWallTitle')
                }
                description={
                  showSearchResults
                    ? t('discover.modal.mikan.emptySearchDescription')
                    : t('discover.modal.mikan.emptyWallDescription')
                }
              />
            )}

            {items.length > 0
              && (showSearchResults
                ? (
                    <MikanSearchResults />
                  )
                : (
                    <MikanSeasonWall />
                  ))}
          </>
        )}
      </ScrollArea>
    </div>
  )
}
