import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'

export const DiscoverResultsToolbar = () => {
  const { t } = useTranslation('app')
  const actions = DiscoverModalActions.shared
  const { selection, importing: importingSlice } = actions.slices

  const items = useDiscoverModalStore((state) => state.items)
  const selectedIds = useDiscoverModalStore((state) => state.selectedIds)
  const importing = useDiscoverModalStore((state) => state.importing)
  const committedSearch = useDiscoverModalStore(
    (state) => state.committedSearch,
  )
  const total = useDiscoverModalStore((state) => state.total)
  const totalPages = useDiscoverModalStore((state) => state.totalPages)

  const summaryText = committedSearch
    ? t('discover.modal.resultCount', {
        count: total ?? items.length,
      })
    : t('discover.modal.resultPlaceholder')

  const pageText = committedSearch
    ? t('discover.modal.currentPage', {
        page: committedSearch.page ?? 1,
        totalPages: total ? totalPages : '?',
      })
    : undefined

  const selectedCount = selectedIds.size

  const importLabel = t('discover.modal.importSelected', {
    count: selectedCount,
  })

  const importDisabled = selectedCount === 0 || importing

  const hasItems = items.length > 0
  const allSelected = hasItems && selectedIds.size === items.length

  return (
    <div className="flex items-center justify-between sticky top-0 border-b z-10 border-border backdrop-blur-background bg-background/60 px-4 h-14">
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary px-2">
        <span>{summaryText}</span>
        {pageText ? <span>{pageText}</span> : null}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selection.selectAll()}
          disabled={!hasItems}
        >
          <span>
            {allSelected
              ? t('discover.modal.clearSelection')
              : t('discover.modal.selectAll')}
          </span>
        </Button>
        <Button
          size="sm"
          onClick={() => {
            void importingSlice.importSelected().then((result) => {
              if (result.error === 'providerNotReady') {
                toast.error(t('discover.messages.providerNotReady'))
              } else if (result.error === 'selectionEmpty') {
                toast.error(t('discover.messages.importFailed'))
              }
            })
          }}
          disabled={importDisabled}
        >
          {importing && (
            <i className="i-mingcute-loading-3-line mr-2 animate-spin" />
          )}
          <span>{importLabel}</span>
        </Button>
      </div>
    </div>
  )
}
