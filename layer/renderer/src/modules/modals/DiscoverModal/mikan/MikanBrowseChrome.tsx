import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { cn } from '~/lib/cn'
import {
  getCurrentMikanSeason,
  MIKAN_SEASONS,
  resolveMikanSeason,
} from '~/modules/discover/providers/mikan/utils'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { DiscoverModalActions } from '../actions'
import { DiscoverSearchInput } from '../components'
import { useDiscoverModalStore } from '../store'
import { mikanSeasonControlsVisible } from './stack'
import { buildSubscriptionBadgeModel } from './subscription-badge-model'

const MIKAN_SEASON_LABELS = {
  春: 'discover.modal.mikan.season.spring',
  夏: 'discover.modal.mikan.season.summer',
  秋: 'discover.modal.mikan.season.autumn',
  冬: 'discover.modal.mikan.season.winter',
} as const

const seasonValue = (year: number, season: string) => `${year}:${season}`

const parseSeasonValue = (value: string) => {
  const [yearPart, seasonPart] = value.split(':')
  const year = Number(yearPart)
  const season = resolveMikanSeason(seasonPart)
  if (!Number.isFinite(year) || !season) {
    return null
  }
  return { year, season }
}

export const MikanSearchField = () => {
  const { t } = useTranslation('app')
  return (
    <DiscoverSearchInput
      placeholder={t('discover.modal.mikan.keywordPlaceholder')}
    />
  )
}

export const MikanSeasonPicker = () => {
  const { t } = useTranslation('app')
  const { form } = DiscoverModalActions.shared.slices
  const filters = useDiscoverModalStore((state) => state.filters)
  const current = getCurrentMikanSeason()
  const parsedYear =
    typeof filters.year === 'number'
      ? filters.year
      : typeof filters.year === 'string' && filters.year.trim()
        ? Number(filters.year)
        : Number.NaN
  const year = Number.isFinite(parsedYear) ? parsedYear : current.year
  const season = resolveMikanSeason(filters.season) ?? current.season
  const thisYear = new Date().getFullYear()
  const years = Array.from(
    { length: thisYear - 2013 },
    (_, index) => thisYear - index,
  )

  return (
    <Select
      value={seasonValue(year, season)}
      onValueChange={(value) => {
        const next = parseSeasonValue(value)
        if (!next) {
          return
        }
        form.updateFilters((prev) => ({
          ...prev,
          year: next.year,
          season: next.season,
        }))
      }}
    >
      <SelectTrigger className="h-9 w-[8.5rem]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((option) => (
          <SelectGroup key={option}>
            <SelectLabel>{option}</SelectLabel>
            {MIKAN_SEASONS.map((entry) => (
              <SelectItem
                key={seasonValue(option, entry)}
                value={seasonValue(option, entry)}
              >
                {option} {t(MIKAN_SEASON_LABELS[entry])}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export const MikanSubscriptionBadge = () => {
  const { t } = useTranslation('app')
  const items = useSubscriptionsStore((state) => state.items)
  const optimistic = useSubscriptionsStore((state) => state.optimistic)
  const statusByServer = useSubscriptionsStore((state) => state.statusByServer)
  const capabilitiesByServer = useSubscriptionsStore(
    (state) => state.capabilitiesByServer,
  )
  const { mikan } = DiscoverModalActions.shared.slices

  const { count, tone } = useMemo(
    () =>
      buildSubscriptionBadgeModel({
        items,
        optimistic,
        statusByServer,
        capabilitiesByServer,
        syncing: false,
      }),
    [items, optimistic, statusByServer, capabilitiesByServer],
  )
  const label = t('discover.modal.mikan.subscriptionBadge', { count })

  return (
    <Button
      aria-label={label}
      className="relative h-9 w-9 shrink-0 p-0"
      title={label}
      variant="ghost"
      onClick={() => mikan.pushSubscriptions()}
    >
      <i className="i-mingcute-notification-line text-lg" />
      {count > 0 && (
        <span
          className={cn(
            'absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium text-background',
            tone === 'destructive' ? 'bg-red' : 'bg-accent',
          )}
        >
          {count}
        </span>
      )}
    </Button>
  )
}

export const MikanBrowseHeaderEnd = () => {
  const keyword = useDiscoverModalStore((state) => state.keyword)
  const showSeason = mikanSeasonControlsVisible(keyword)

  return (
    <>
      {showSeason && <MikanSeasonPicker />}
      <MikanSubscriptionBadge />
    </>
  )
}
