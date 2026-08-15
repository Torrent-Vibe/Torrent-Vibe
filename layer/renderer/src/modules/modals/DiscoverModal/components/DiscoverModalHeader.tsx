import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { DiscoverProviderId } from '~/atoms/settings/discover'
import { Button } from '~/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { cn } from '~/lib/cn'
import { useDiscoverProviders } from '~/modules/discover/hooks/useDiscoverProviders'
import {
  getCurrentMikanSeason,
  MIKAN_SEASONS,
  resolveMikanSeason,
} from '~/modules/discover/providers/mikan/utils'

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { DiscoverSearchInput } from './DiscoverSearchInput'

const MIKAN_SEASON_LABELS = {
  春: 'discover.modal.mikan.season.spring',
  夏: 'discover.modal.mikan.season.summer',
  秋: 'discover.modal.mikan.season.autumn',
  冬: 'discover.modal.mikan.season.winter',
} as const

const MikanSeasonPicker = () => {
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

interface DiscoverModalHeaderProps {
  onClose: () => void
}

export const DiscoverModalHeader = ({ onClose }: DiscoverModalHeaderProps) => {
  const { t } = useTranslation(['app', 'setting'])
  const providers = useDiscoverProviders()
  const activeProviderId = useDiscoverModalStore(
    state => state.activeProviderId,
  )
  const actions = DiscoverModalActions.shared
  const { provider } = actions.slices

  const providerOptions = useMemo(
    () =>
      providers.map(provider => ({
        id: provider.id,
        label: provider.implementation.label,
        ready: provider.ready,
      })),
    [providers],
  )

  return (
    <header className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 macos:electron:mt-6">
          <h2 className="text-[1.35rem] font-semibold leading-tight">
            {t('discover.modal.title')}
          </h2>
          <p className="max-w-2xl text-sm text-text-secondary">
            {t('discover.modal.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Select
            value={activeProviderId}
            onValueChange={value =>
              provider.setActiveProviderId(value as DiscoverProviderId)}
          >
            <SelectTrigger className="h-9 w-full sm:w-72 no-drag-region">
              <SelectValue
                placeholder={t('discover.modal.providerPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{provider.label}</span>
                    <i
                      className={cn(
                        'text-base',
                        provider.ready
                          ? 'i-mingcute-check-line text-green'
                          : 'i-mingcute-warning-line text-yellow',
                      )}
                    />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => presentSettingsModal({ tab: 'discover' })}
          >
            <i className="i-mingcute-settings-3-line mr-2" />
            <span>{t('discover.modal.settings')}</span>
          </Button>
          <Button variant="ghost" className="h-9" onClick={onClose}>
            <i className="i-mingcute-close-line mr-2" />
            <span>{t('discover.modal.close')}</span>
          </Button>
        </div>
      </div>
      {activeProviderId === 'mikan' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="min-w-[16rem] flex-1">
            <DiscoverSearchInput
              placeholder={t('discover.modal.mikan.keywordPlaceholder')}
            />
          </div>
          <MikanSeasonPicker />
        </div>
      )}
    </header>
  )
}
