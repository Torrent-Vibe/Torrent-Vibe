import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { MikanBangumiHeaderActions } from './MikanBangumiHeaderActions'
import { MikanBrowseHeaderEnd, MikanSearchField } from './MikanBrowseChrome'
import { mikanStackTop } from './stack'

export const MikanChrome = () => {
  const { t } = useTranslation('app')
  const { mikan } = DiscoverModalActions.shared.slices
  const stack = useDiscoverModalStore((state) => state.mikanStack)
  const items = useDiscoverModalStore((state) => state.items)
  const detail = useDiscoverModalStore((state) => state.mikanDetail)
  const bangumiId = useDiscoverModalStore((state) => state.mikanBangumiId)
  const top = mikanStackTop(stack)

  if (!top) {
    return (
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <div className="min-w-0 flex-1">
          <MikanSearchField />
        </div>
        <MikanBrowseHeaderEnd />
      </div>
    )
  }

  const bangumiTitle =
    detail?.title ??
    items.find((item) => item.id === bangumiId)?.title ??
    bangumiId ??
    ''

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <Button
          className="shrink-0"
          size="sm"
          variant="ghost"
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
      {top.type === 'bangumi' ? <MikanBangumiHeaderActions /> : null}
    </div>
  )
}
