import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '~/lib/cn'
import type { DiscoverItem } from '~/modules/discover'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import {
  groupItemsByWeekday,
  resolveMikanCoverUrl,
  weekdayLabelKey,
} from './helpers'

export const MikanBangumiCard = ({
  item,
  onSelect,
}: {
  item: DiscoverItem
  onSelect: (item: DiscoverItem) => void
}) => {
  const extra = asMikanBangumiExtra(item.extra)
  const cover = resolveMikanCoverUrl(extra?.coverUrl)

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="group flex flex-col gap-1.5 text-left"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-fill-secondary">
        {cover
          ? (
              <img
                src={cover}
                alt={item.title}
                loading="lazy"
                className="size-full object-cover transition duration-200 group-hover:scale-[1.03]"
              />
            )
          : (
              <div className="flex size-full items-center justify-center text-text-tertiary">
                <i className="i-mingcute-movie-line text-2xl" />
              </div>
            )}
      </div>
      <span className="line-clamp-2 text-sm font-medium text-text">
        {item.title}
      </span>
    </button>
  )
}

export const MikanSeasonWall = () => {
  const { t } = useTranslation('app')
  const items = useDiscoverModalStore(state => state.items)
  const { mikan } = DiscoverModalActions.shared.slices
  const groups = useMemo(() => groupItemsByWeekday(items), [items])

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {groups.map(group => (
        <section key={group.weekday} className="space-y-3">
          <h3 className="text-sm font-semibold text-text-secondary">
            {t(weekdayLabelKey(group.weekday))}
          </h3>
          <div
            className={cn(
              'grid gap-3',
              'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
            )}
          >
            {group.items.map(item => (
              <MikanBangumiCard
                key={item.id}
                item={item}
                onSelect={mikan.openBangumi}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
