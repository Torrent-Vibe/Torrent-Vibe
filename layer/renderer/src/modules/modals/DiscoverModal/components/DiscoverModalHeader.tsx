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
import { useDiscoverModalStore } from '../store'

interface DiscoverModalHeaderProps {
  onClose: () => void
}

export const DiscoverModalHeader = ({ onClose }: DiscoverModalHeaderProps) => {
  const { t } = useTranslation(['app', 'setting'])
  const providers = useDiscoverProviders()
  const activeProviderId = useDiscoverModalStore(
    (state) => state.activeProviderId,
  )
  const actions = DiscoverModalActions.shared
  const { provider } = actions.slices

  const providerOptions = useMemo(
    () =>
      providers.map((provider) => ({
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
            onValueChange={(value) =>
              provider.setActiveProviderId(value as DiscoverProviderId)
            }
          >
            <SelectTrigger className="h-9 w-full sm:w-72 no-drag-region">
              <SelectValue
                placeholder={t('discover.modal.providerPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {providerOptions.map((provider) => (
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
    </header>
  )
}
