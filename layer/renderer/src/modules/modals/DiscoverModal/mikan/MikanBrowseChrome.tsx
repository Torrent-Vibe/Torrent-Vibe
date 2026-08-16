import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  getCurrentMikanSeason,
  MIKAN_SEASONS,
  resolveMikanSeason,
} from '~/modules/discover/providers/mikan/utils'
import {
  useCurrentHelperPaired,
  useCurrentHelperTarget,
} from '~/modules/helper-client/hooks'
import { useSubscriptionsStore } from '~/modules/subscriptions/store'

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import { DiscoverSearchInput } from '../components'
import { useDiscoverModalStore } from '../store'
import { openHelperSettings } from './bangumi-actions'
import { mikanSeasonControlsVisible } from './stack'

const MIKAN_SEASON_LABELS = {
  春: 'discover.modal.mikan.season.spring',
  夏: 'discover.modal.mikan.season.summer',
  秋: 'discover.modal.mikan.season.autumn',
  冬: 'discover.modal.mikan.season.winter',
} as const

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
  const filters = useDiscoverModalStore(state => state.filters)
  const current = getCurrentMikanSeason()
  const parsedYear
    = typeof filters.year === 'number'
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
    <div className="flex items-center gap-1.5">
      <Select
        value={String(year)}
        onValueChange={(value) => {
          form.updateFilters(prev => ({
            ...prev,
            year: Number(value),
            season,
          }))
        }}
      >
        <SelectTrigger className="h-9 w-[6.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map(option => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={season}
        onValueChange={(value) => {
          form.updateFilters(prev => ({
            ...prev,
            year,
            season: value,
          }))
        }}
      >
        <SelectTrigger className="h-9 w-[7.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MIKAN_SEASONS.map(option => (
            <SelectItem key={option} value={option}>
              {t(MIKAN_SEASON_LABELS[option])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export const MikanHelperChip = () => {
  const { t } = useTranslation('app')
  const paired = useCurrentHelperPaired()
  const target = useCurrentHelperTarget()
  const statusError = useSubscriptionsStore((state) => {
    const serverId = target?.id
    return serverId ? state.statusByServer[serverId]?.error : undefined
  })

  if (!paired) {
    return (
      <button
        type="button"
        className="h-9 shrink-0 px-1.5 text-xs text-text-tertiary hover:text-accent"
        onClick={() =>
          presentSettingsModal({
            tab: ELECTRON ? 'servers' : 'appConnection',
          })}
      >
        {t('discover.modal.mikan.helperUnboundChip')}
      </button>
    )
  }

  if (statusError) {
    return (
      <button
        type="button"
        className="h-9 shrink-0 px-1.5 text-xs text-text-tertiary hover:text-accent"
        onClick={openHelperSettings}
      >
        {t('discover.modal.mikan.helperUnreachableChip')}
      </button>
    )
  }

  return (
    <p className="flex h-9 shrink-0 items-center gap-1.5 px-1.5 text-xs text-text-secondary">
      <span className="size-1.5 rounded-full bg-green" />
      {target?.name}
    </p>
  )
}

export const MikanSubscriptionBadge = () => {
  const { t } = useTranslation('app')
  const count = useSubscriptionsStore(state => state.items.length)
  const { mikan } = DiscoverModalActions.shared.slices

  return (
    <Button
      variant="secondary"
      className="h-9 shrink-0"
      onClick={() => mikan.pushSubscriptions()}
    >
      {t('discover.modal.mikan.subscriptionBadge', { count })}
    </Button>
  )
}

export const MikanBrowseHeaderEnd = () => {
  const keyword = useDiscoverModalStore(state => state.keyword)
  const showSeason = mikanSeasonControlsVisible(keyword)

  return (
    <>
      {showSeason && <MikanSeasonPicker />}
      <MikanSubscriptionBadge />
      <MikanHelperChip />
    </>
  )
}
