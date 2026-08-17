import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

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
import { selectDiscoverProvider } from '../actions/lastProvider'
import { discoverPath, isDiscoverProviderId } from '../open'

const ProviderSelect = () => {
  const { t } = useTranslation(['app', 'setting'])
  const navigate = useNavigate()
  const { type } = useParams()
  const providers = useDiscoverProviders()
  const activeProviderId = isDiscoverProviderId(type) ? type : undefined

  const providerOptions = useMemo(
    () =>
      providers.map((entry) => ({
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
        navigate(discoverPath(next), { replace: true })
      }}
    >
      <SelectTrigger className="h-9 w-full no-drag-region sm:w-72">
        <SelectValue placeholder={t('discover.modal.providerPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        {providerOptions.map((option) => (
          <SelectItem
            disabled={!option.ready}
            key={option.id}
            value={option.id}
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

export const DiscoverModalHeader = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation(['app', 'setting'])

  return (
    <header className="flex items-center gap-2 border-b border-border px-4 py-3 macos:electron:pt-10">
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="text-[1.35rem] font-semibold leading-tight">
          {t('discover.modal.title')}
        </h2>
        <p className="max-w-2xl text-sm text-text-secondary">
          {t('discover.modal.subtitle')}
        </p>
      </div>
      <ProviderSelect />
      <Button
        className="h-9"
        variant="ghost"
        onClick={() => presentSettingsModal({ tab: 'discover' })}
      >
        <i className="i-mingcute-settings-3-line mr-2" />
        <span>{t('discover.modal.settings')}</span>
      </Button>
      <Button className="h-9" variant="ghost" onClick={onClose}>
        <i className="i-mingcute-close-line mr-2" />
        <span>{t('discover.modal.close')}</span>
      </Button>
    </header>
  )
}
