import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import { useDiscoverProviders } from '~/modules/discover/hooks/useDiscoverProviders'
import { ResizableLayout } from '~/modules/layout'
import type { ResizablePanelConfig } from '~/modules/layout/desktop/components/ResizableLayout'

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import {
  DiscoverEmptyState,
  DiscoverFilterBar,
  DiscoverPreviewPanel,
  DiscoverResultsList,
  DiscoverResultsToolbar,
} from '../components'
import { useDiscoverModalStore } from '../store'

const { search: searchActions } = DiscoverModalActions.shared.slices

export const MTeamBody = () => {
  const { t } = useTranslation('app')
  const providers = useDiscoverProviders()

  const activeProviderId = useDiscoverModalStore(
    (state) => state.activeProviderId,
  )
  const providerReady = useDiscoverModalStore((state) => state.providerReady)
  const committedSearch = useDiscoverModalStore(
    (state) => state.committedSearch,
  )
  const isSearching = useDiscoverModalStore((state) => state.isSearching)
  const items = useDiscoverModalStore((state) => state.items)
  const hasMore = useDiscoverModalStore((state) => state.hasMore)
  const previewId = useDiscoverModalStore((state) => state.previewId)

  const activeProvider = providers.find(
    (provider) => provider.id === activeProviderId,
  )
  const hasReadyProviders = providers.some((provider) => provider.ready)

  const showPagination = Boolean(
    committedSearch && (hasMore || (committedSearch?.page ?? 1) > 1),
  )
  const disablePrev = Boolean(
    !committedSearch || isSearching || (committedSearch.page ?? 1) <= 1,
  )
  const disableNext = Boolean(!committedSearch || isSearching || !hasMore)
  const showLoading = Boolean(isSearching && committedSearch)

  const resizablePanel = useMemo<ResizablePanelConfig | undefined>(() => {
    return {
      isVisible: !!previewId,
      width: 400,
      minWidth: 280,
      maxWidth: 600,
      render: ({ width }) => <DiscoverPreviewPanel style={{ width }} />,
    }
  }, [previewId])

  return (
    <>
      <DiscoverFilterBar />
      <div className="relative flex h-0 flex-1 gap-3">
        <div className="absolute inset-0 flex min-w-0 grow flex-row overflow-hidden bg-background-secondary/30">
          <ResizableLayout
            resizablePanel={resizablePanel}
            mainContent={
              <div className="flex h-0 flex-1 flex-col">
                <DiscoverResultsToolbar />
                <ScrollArea
                  rootClassName="flex-1 h-0"
                  viewportClassName="bg-background"
                >
                  {(!hasReadyProviders ||
                    !providerReady ||
                    !activeProvider) && (
                    <DiscoverEmptyState
                      actionLabel={t('discover.modal.configureProviders')}
                      description={t('discover.modal.noProviderDescription')}
                      icon="i-mingcute-settings-4-line"
                      title={t('discover.modal.noProviderTitle')}
                      onAction={() => presentSettingsModal({ tab: 'discover' })}
                    />
                  )}

                  {hasReadyProviders &&
                    providerReady &&
                    committedSearch === null &&
                    items.length === 0 && (
                      <DiscoverEmptyState
                        description={t('discover.modal.waitingDescription')}
                        icon="i-mingcute-search-2-line"
                        title={t('discover.modal.waitingTitle')}
                      />
                    )}

                  {showLoading && (
                    <div className="flex items-center justify-center gap-1.5 py-10 text-text-tertiary">
                      <i className="i-mingcute-loading-3-line animate-spin text-lg" />
                      <span>{t('discover.modal.loading')}</span>
                    </div>
                  )}

                  {items.length > 0 && <DiscoverResultsList />}
                </ScrollArea>

                {showPagination && (
                  <div className="sticky bottom-0 flex items-center justify-end border-t border-border bg-background px-4 py-2.5 text-sm text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Button
                        disabled={disablePrev}
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!committedSearch) {
                            return
                          }
                          void searchActions.goToPage(
                            Math.max(1, committedSearch.page - 1),
                          )
                        }}
                      >
                        <i className="i-mingcute-arrow-left-line mr-1" />
                        <span>{t('discover.modal.prev')}</span>
                      </Button>
                      <Button
                        disabled={disableNext}
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (!committedSearch) {
                            return
                          }
                          void searchActions.goToPage(committedSearch.page + 1)
                        }}
                      >
                        <span>{t('discover.modal.next')}</span>
                        <i className="i-mingcute-arrow-right-line ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
    </>
  )
}
