import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { DiscoverProviderId } from '~/atoms/settings/discover'
import { Button } from '~/components/ui/button'
import type { ModalComponent } from '~/components/ui/modal'
import { ScrollArea } from '~/components/ui/scroll-areas/ScrollArea'
import type { DiscoverFilterDefinition } from '~/modules/discover'
import { useDiscoverProviders } from '~/modules/discover/hooks/useDiscoverProviders'
import { ResizableLayout } from '~/modules/layout'
import type { ResizablePanelConfig } from '~/modules/layout/desktop/components/ResizableLayout'

import { presentSettingsModal } from '../SettingsModal'
import { DiscoverModalActions } from './actions'
import {
  DiscoverEmptyState,
  DiscoverFilterBar,
  DiscoverModalHeader,
  DiscoverPreviewPanel,
  DiscoverResultsList,
  DiscoverResultsToolbar,
} from './components'
import { useDiscoverModalStore } from './store'

const actions = DiscoverModalActions.shared
const { provider: providerActions, search: searchActions } = actions.slices

const buildInitialFilters = (definitions: DiscoverFilterDefinition[]) => {
  return definitions.reduce<Record<string, unknown>>((acc, definition) => {
    if (definition.defaultValue !== undefined) {
      acc[definition.id] = definition.defaultValue
    }
    return acc
  }, {})
}

const computeDefinitionsSignature = (
  providerId: DiscoverProviderId,
  ready: boolean,
  pageSize: number,
  definitions: DiscoverFilterDefinition[],
) =>
  JSON.stringify({
    providerId,
    ready,
    pageSize,
    definitions,
  })

export const DiscoverModal: ModalComponent = ({ dismiss }) => {
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
  const searchError = useDiscoverModalStore((state) => state.searchError)

  const lastConfiguredSignature = useRef<string | null>(null)

  // Ensure active provider id stays valid when provider list changes
  useEffect(() => {
    if (providers.length === 0) return

    if (!providers.some((provider) => provider.id === activeProviderId)) {
      providerActions.setActiveProviderId(providers[0]!.id)
    }
  }, [providers, activeProviderId])

  useEffect(() => {
    if (providers.length === 0) return

    const provider =
      providers.find((item) => item.id === activeProviderId) ?? providers[0]

    if (!provider) return

    const filterDefinitions =
      provider.implementation.getFilterDefinitions?.(
        provider.config as never,
      ) ?? []

    const signature = computeDefinitionsSignature(
      provider.id,
      provider.ready,
      provider.config.pageSize ?? 20,
      filterDefinitions,
    )

    if (signature !== lastConfiguredSignature.current) {
      lastConfiguredSignature.current = signature
      providerActions.configureProvider({
        providerId: provider.id,
        providerReady: provider.ready,
        pageSize: provider.config.pageSize ?? 20,
        descriptionRenderer:
          provider.implementation.previewDescriptionRenderer ?? 'markdown',
        filterDefinitions,
        defaultFilters: buildInitialFilters(filterDefinitions),
      })
      return
    }

    providerActions.updateProviderMeta({
      providerId: provider.id,
      providerReady: provider.ready,
      pageSize: provider.config.pageSize ?? 20,
      descriptionRenderer:
        provider.implementation.previewDescriptionRenderer ?? 'markdown',
    })
  }, [providers, activeProviderId])

  useEffect(() => {
    if (searchError === 'requestFailed') {
      toast.error(t('discover.messages.searchFailed'))
    }
  }, [searchError, t])

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

  const previewId = useDiscoverModalStore((state) => state.previewId)
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
    <div className="flex h-full w-full flex-col bg-background text-text">
      <DiscoverModalHeader onClose={dismiss} />

      <DiscoverFilterBar />

      <div className="flex flex-1 gap-3 h-0 relative">
        <div className="flex min-w-0 flex-1 flex-row grow overflow-hidden absolute inset-0 bg-background-secondary/30">
          <ResizableLayout
            mainContent={
              <div className="flex-1 flex flex-col h-0">
                <DiscoverResultsToolbar />
                <ScrollArea
                  rootClassName="flex-1 h-0"
                  viewportClassName="bg-background"
                >
                  {(!hasReadyProviders ||
                    !providerReady ||
                    !activeProvider) && (
                    <DiscoverEmptyState
                      icon="i-mingcute-settings-4-line"
                      title={t('discover.modal.noProviderTitle')}
                      description={t('discover.modal.noProviderDescription')}
                      actionLabel={t('discover.modal.configureProviders')}
                      onAction={() => presentSettingsModal({ tab: 'discover' })}
                    />
                  )}

                  {hasReadyProviders &&
                    providerReady &&
                    committedSearch === null &&
                    items.length === 0 && (
                      <DiscoverEmptyState
                        icon="i-mingcute-search-2-line"
                        title={t('discover.modal.waitingTitle')}
                        description={t('discover.modal.waitingDescription')}
                      />
                    )}

                  {showLoading && (
                    <div className="flex items-center justify-center py-10 text-text-tertiary gap-1.5">
                      <i className="i-mingcute-loading-3-line animate-spin text-lg" />
                      <span>{t('discover.modal.loading')}</span>
                    </div>
                  )}

                  {items.length > 0 && <DiscoverResultsList />}
                </ScrollArea>

                {showPagination && (
                  <div className="flex items-center sticky bottom-0 justify-end border-t border-border bg-background px-4 py-2.5 text-sm text-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disablePrev}
                        onClick={() => {
                          if (!committedSearch) return
                          void searchActions.goToPage(
                            Math.max(1, committedSearch.page - 1),
                          )
                        }}
                      >
                        <i className="i-mingcute-arrow-left-line mr-1" />
                        <span>{t('discover.modal.prev')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disableNext}
                        onClick={() => {
                          if (!committedSearch) return
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
            resizablePanel={resizablePanel}
          />
        </div>
      </div>
    </div>
  )
}

DiscoverModal.contentClassName =
  'w-full h-full max-w-none max-h-none p-0 rounded-none'
DiscoverModal.showCloseButton = false
DiscoverModal.disableDrag = true
