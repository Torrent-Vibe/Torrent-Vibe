import { AdvancedFilters } from './components/AdvancedFilters'
import { FilterTabs } from './components/FilterTabs'

export const TorrentTableToolbar = () => {
  return (
    <div className="flex flex-col gap-3 px-4 bg-background border-b border-border">
      {/* Filter tabs and Advanced filters */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-1">
        <FilterTabs />
        <AdvancedFilters />
      </div>
    </div>
  )
}
