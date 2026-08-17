import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import type { DiscoverProviderId } from '~/atoms/settings/discover'
import type { DiscoverFilterDefinition } from '~/modules/discover'
import { useDiscoverProviders } from '~/modules/discover/hooks/useDiscoverProviders'

import { DiscoverModalActions } from './actions'
import { DiscoverModalHeader } from './components'
import { isDiscoverProviderId } from './open'
import { useDiscoverModalStore } from './store'

const { provider: providerActions } = DiscoverModalActions.shared.slices

const buildInitialFilters = (definitions: DiscoverFilterDefinition[]) => {
  return definitions.reduce<Record<string, unknown>>((acc, definition) => {
    if (definition.defaultValue !== undefined) {
      acc[definition.id] = definition.defaultValue
    }
    return acc
  }, {})
}

const computeDefinitionsSignature = (
  providerId: DiscoverProviderId,
  ready: boolean,
  pageSize: number,
  definitions: DiscoverFilterDefinition[],
) =>
  JSON.stringify({
    providerId,
    ready,
    pageSize,
    definitions,
  })

export const DiscoverModal = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation('app')
  const navigate = useNavigate()
  const { type } = useParams()
  const providers = useDiscoverProviders()
  const searchError = useDiscoverModalStore((state) => state.searchError)
  const lastConfiguredSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isDiscoverProviderId(type) || providers.length === 0) {
      return
    }

    const provider = providers.find((item) => item.id === type)

    if (!provider) {
      return
    }

    const filterDefinitions =
      provider.implementation.getFilterDefinitions?.(
        provider.config as never,
      ) ?? []

    const signature = computeDefinitionsSignature(
      provider.id,
      provider.ready,
      provider.config.pageSize ?? 20,
      filterDefinitions,
    )

    if (signature !== lastConfiguredSignatureRef.current) {
      lastConfiguredSignatureRef.current = signature
      providerActions.configureProvider({
        providerId: provider.id,
        providerReady: provider.ready,
        pageSize: provider.config.pageSize ?? 20,
        descriptionRenderer:
          provider.implementation.previewDescriptionRenderer ?? 'markdown',
        filterDefinitions,
        defaultFilters: buildInitialFilters(filterDefinitions),
      })
      return
    }

    providerActions.updateProviderMeta({
      providerId: provider.id,
      providerReady: provider.ready,
      pageSize: provider.config.pageSize ?? 20,
      descriptionRenderer:
        provider.implementation.previewDescriptionRenderer ?? 'markdown',
    })
  }, [providers, type])

  useEffect(() => {
    if (searchError === 'requestFailed') {
      toast.error(t('discover.messages.searchFailed'))
    }
  }, [searchError, t])

  if (!isDiscoverProviderId(type)) {
    return <div className="h-screen bg-background" />
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background text-text">
      {ELECTRON && <div className="fixed inset-x-0 top-0 h-10 drag-region" />}
      <DiscoverModalHeader onClose={() => navigate('/')} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
