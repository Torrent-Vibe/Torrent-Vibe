import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { SubscriptionActions } from '~/modules/subscriptions'

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import { DiscoverEmptyState, DiscoverModalHeader } from '../components'
import { useDiscoverModalStore } from '../store'
import { MikanBangumiHeaderActions } from './MikanBangumiHeaderActions'
import { MikanBangumiPage } from './MikanBangumiPage'
import { MikanBrowseHeaderEnd, MikanSearchField } from './MikanBrowseChrome'
import { MikanSearchResults } from './MikanSearchResults'
import { MikanSeasonWall } from './MikanSeasonWall'
import { MikanSubscriptionsTab } from './MikanSubscriptionsTab'
import { mikanBrowseBody, mikanStackTop } from './stack'

export const MikanWorkspace = ({ onClose }: { onClose: () => void }) => {
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
  const stack = useDiscoverModalStore(state => state.mikanStack)
  const browseScroll = useDiscoverModalStore(state => state.mikanBrowseScroll)
  const detail = useDiscoverModalStore(state => state.mikanDetail)
  const bangumiId = useDiscoverModalStore(state => state.mikanBangumiId)

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
    const switchedBody
      = previousStackLenRef.current === 0
        && stack.length === 0
        && previousBodyRef.current !== bodyMode

    if (leftStack || switchedBody) {
      node.scrollTop = browseScroll[bodyMode]
    }

    previousStackLenRef.current = stack.length
    previousBodyRef.current = bodyMode
  }, [bodyMode, browseScroll, stack.length])

  const bangumiTitle
    = detail?.title
      ?? items.find(item => item.id === bangumiId)?.title
      ?? bangumiId
      ?? ''

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      {top
        ? (
            <DiscoverModalHeader
              start={(
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => mikan.popStack()}
                  >
                    <i className="i-mingcute-arrow-left-line mr-1" />
                    <span>{t('discover.modal.mikan.back')}</span>
                  </Button>
                  <h2 className="min-w-0 truncate text-sm font-semibold">
                    {top.type === 'subscriptions'
                      ? t('discover.modal.mikan.subscriptionsTitle')
                      : bangumiTitle}
                  </h2>
                </div>
              )}
              end={top.type === 'bangumi' ? <MikanBangumiHeaderActions /> : null}
              provider={false}
              onClose={onClose}
            />
          )
        : (
            <DiscoverModalHeader
              start={<MikanSearchField />}
              end={<MikanBrowseHeaderEnd />}
              providerCompact
              onClose={onClose}
            />
          )}

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
            icon="i-mingcute-settings-4-line"
            title={t('discover.modal.noProviderTitle')}
            description={t('discover.modal.noProviderDescription')}
            actionLabel={t('discover.modal.configureProviders')}
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
