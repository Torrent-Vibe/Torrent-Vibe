import type { ReactNode } from 'react'
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

import { presentSettingsModal } from '../../SettingsModal'
import { DiscoverModalActions } from '../actions'
import { selectDiscoverProvider } from '../actions/lastProvider'
import { useDiscoverModalStore } from '../store'

const ProviderSelect = ({ compact }: { compact?: boolean }) => {
  const { t } = useTranslation(['app', 'setting'])
  const providers = useDiscoverProviders()
  const activeProviderId = useDiscoverModalStore(
    state => state.activeProviderId,
  )
  const { provider } = DiscoverModalActions.shared.slices

  const providerOptions = useMemo(
    () =>
      providers.map(entry => ({
        id: entry.id,
        label: entry.implementation.label,
        ready: entry.ready,
      })),
    [providers],
  )

  return (
    <Select
      value={activeProviderId}
      onValueChange={(value) => {
        const next = value as DiscoverProviderId
        if (selectDiscoverProvider(next, providerOptions) === 'settings') {
          presentSettingsModal({ tab: 'discover' })
          return
        }
        provider.setActiveProviderId(next)
      }}
    >
      <SelectTrigger
        className={cn(
          'h-9 no-drag-region',
          compact ? 'w-[9.5rem]' : 'w-full sm:w-72',
        )}
      >
        <SelectValue placeholder={t('discover.modal.providerPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {providerOptions.map(option => (
          <SelectItem
            key={option.id}
            value={option.id}
            disabled={!option.ready}
            className={cn(
              !option.ready && 'data-[disabled]:pointer-events-auto',
            )}
            onPointerDown={(event) => {
              if (option.ready) {
                return
              }
              event.preventDefault()
              presentSettingsModal({ tab: 'discover' })
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{option.label}</span>
              <i
                className={cn(
                  'text-base',
                  option.ready
                    ? 'i-mingcute-check-line text-green'
                    : 'i-mingcute-warning-line text-yellow',
                )}
              />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface DiscoverModalHeaderProps {
  start: ReactNode
  end?: ReactNode
  provider?: boolean
  providerCompact?: boolean
  settings?: boolean
  onClose: () => void
}

export const DiscoverModalHeader = ({
  start,
  end,
  provider = true,
  providerCompact,
  settings = false,
  onClose,
}: DiscoverModalHeaderProps) => {
  const { t } = useTranslation(['app', 'setting'])

  return (
    <header className="flex items-center gap-2 border-b border-border px-4 py-3 macos:electron:pt-10">
      <div className="flex min-w-0 flex-1 items-center gap-2">{start}</div>
      {end}
      {provider && <ProviderSelect compact={providerCompact} />}
      {settings && (
        <Button
          variant="ghost"
          className="h-9"
          onClick={() => presentSettingsModal({ tab: 'discover' })}
        >
          <i className="i-mingcute-settings-3-line mr-2" />
          <span>{t('discover.modal.settings')}</span>
        </Button>
      )}
      <Button variant="ghost" className="h-9" onClick={onClose}>
        <i className="i-mingcute-close-line mr-2" />
        <span>{t('discover.modal.close')}</span>
      </Button>
    </header>
  )
}

export const DiscoverMTeamHeaderStart = () => {
  const { t } = useTranslation('app')
  return (
    <div className="space-y-1">
      <h2 className="text-[1.35rem] font-semibold leading-tight">
        {t('discover.modal.title')}
      </h2>
      <p className="max-w-2xl text-sm text-text-secondary">
        {t('discover.modal.subtitle')}
      </p>
    </div>
  )
}
