import { cn } from '~/lib/cn'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { MikanBangumiCard } from './MikanSeasonWall'

export const MikanSearchResults = () => {
  const items = useDiscoverModalStore(state => state.items)
  const { mikan } = DiscoverModalActions.shared.slices

  return (
    <div className="px-4 py-4">
      <div
        className={cn(
          'grid gap-3',
          'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        )}
      >
        {items.map(item => (
          <MikanBangumiCard
            key={item.id}
            item={item}
            onSelect={mikan.openBangumi}
          />
        ))}
      </div>
    </div>
  )
}
