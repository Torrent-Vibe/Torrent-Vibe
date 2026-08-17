import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { SubscriptionActions } from '~/modules/subscriptions'

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import { DiscoverEmptyState } from '../components'
import { useDiscoverModalStore } from '../store'
import { MikanBangumiPage } from './MikanBangumiPage'
import { MikanChrome } from './MikanChrome'
import { MikanSearchResults } from './MikanSearchResults'
import { MikanSeasonWall } from './MikanSeasonWall'
import { MikanSubscriptionsTab } from './MikanSubscriptionsTab'
import { mikanBrowseBody, mikanStackTop } from './stack'

export const MikanBody = () => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { search, mikan } = actions.slices

  const providerReady = useDiscoverModalStore((state) => state.providerReady)
  const keyword = useDiscoverModalStore((state) => state.keyword)
  const year = useDiscoverModalStore((state) => state.filters.year)
  const season = useDiscoverModalStore((state) => state.filters.season)
  const committedSearch = useDiscoverModalStore(
    (state) => state.committedSearch,
  )
  const items = useDiscoverModalStore((state) => state.items)
  const isSearching = useDiscoverModalStore((state) => state.isSearching)
  const searchError = useDiscoverModalStore((state) => state.searchError)
  const stack = useDiscoverModalStore((state) => state.mikanStack)
  const browseScroll = useDiscoverModalStore((state) => state.mikanBrowseScroll)

  const seasonKey = `${String(year ?? '')}:${String(season ?? '')}`
  const previousSeasonKeyRef = useRef(seasonKey)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const previousStackLenRef = useRef(stack.length)
  const previousBodyRef = useRef(mikanBrowseBody(committedSearch?.keyword))

  const top = mikanStackTop(stack)
  const bodyMode = mikanBrowseBody(committedSearch?.keyword)
  const showSearchResults = bodyMode === 'search'

  useEffect(() => {
    void SubscriptionActions.shared.refreshStatus()
  }, [])

  useEffect(() => {
    if (!providerReady || stack.length > 0) {
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
  }, [keyword, providerReady, search, seasonKey, stack.length])

  useEffect(() => {
    const node = viewportRef.current
    if (!node) {
      return
    }

    const leftStack = previousStackLenRef.current > 0 && stack.length === 0
    const switchedBody =
      previousStackLenRef.current === 0 &&
      stack.length === 0 &&
      previousBodyRef.current !== bodyMode

    if (leftStack || switchedBody) {
      node.scrollTop = browseScroll[bodyMode]
    }

    previousStackLenRef.current = stack.length
    previousBodyRef.current = bodyMode
  }, [bodyMode, browseScroll, stack.length])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <MikanChrome />
      <ScrollArea
        ref={viewportRef}
        rootClassName="flex-1 h-0"
        viewportClassName="bg-background"
        onScroll={(event) => {
          mikan.saveBrowseScroll(event.currentTarget.scrollTop)
        }}
      >
        {!providerReady && (
          <DiscoverEmptyState
            actionLabel={t('discover.modal.configureProviders')}
            description={t('discover.modal.noProviderDescription')}
            icon="i-mingcute-settings-4-line"
            title={t('discover.modal.noProviderTitle')}
            onAction={() => presentSettingsModal({ tab: 'discover' })}
          />
        )}

        {providerReady && top?.type === 'bangumi' && <MikanBangumiPage />}

        {providerReady && top?.type === 'subscriptions' && (
          <MikanSubscriptionsTab />
        )}

        {providerReady && !top && (
          <>
            {isSearching && items.length === 0 && (
              <div className="flex items-center justify-center gap-1.5 py-10 text-text-tertiary">
                <i className="i-mingcute-loading-3-line animate-spin text-lg" />
                <span>{t('discover.modal.loading')}</span>
              </div>
            )}

            {searchError && items.length === 0 && !isSearching && (
              <DiscoverEmptyState
                actionLabel={t('discover.modal.mikan.retry')}
                description={t('discover.modal.mikan.emptyWallDescription')}
                icon="i-mingcute-warning-line"
                title={t('discover.messages.searchFailed')}
                onAction={() => {
                  void search.performSearch()
                }}
              />
            )}

            {!isSearching && !searchError && items.length === 0 && (
              <DiscoverEmptyState
                icon="i-mingcute-search-2-line"
                description={
                  showSearchResults
                    ? t('discover.modal.mikan.emptySearchDescription')
                    : t('discover.modal.mikan.emptyWallDescription')
                }
                title={
                  showSearchResults
                    ? t('discover.modal.mikan.emptySearchTitle')
                    : t('discover.modal.mikan.emptyWallTitle')
                }
              />
            )}

            {items.length > 0 &&
              (showSearchResults ? (
                <MikanSearchResults />
              ) : (
                <MikanSeasonWall />
              ))}
          </>
        )}
      </ScrollArea>
    </div>
  )
}
