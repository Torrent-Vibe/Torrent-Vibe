import type { AiProviderId } from '@torrent-vibe/shared'
import { DEFAULT_AI_PROVIDER_ORDER } from '@torrent-vibe/shared'

import type { ProviderConfig } from '../types'
import { getProviderById } from './registry'
import type { AiProviderRuntime } from './types'

interface SelectionResult {
  runtime: AiProviderRuntime | null
  error?: string
  triedProviders: AiProviderId[]
}

const buildCandidateOrder = (preferred: AiProviderId[]): AiProviderId[] => {
  const order: AiProviderId[] = []
  const seen = new Set<AiProviderId>()

  for (const id of [...preferred, ...DEFAULT_AI_PROVIDER_ORDER]) {
    if (seen.has(id)) continue
    seen.add(id)
    order.push(id)
  }

  return order
}

export const selectProvider = (config: ProviderConfig): SelectionResult => {
  const preferredOrder = buildCandidateOrder(config.preferredProviders)
  let firstError: string | undefined

  for (const id of preferredOrder) {
    const adapter = getProviderById(id)
    if (!adapter) continue

    if (!adapter.isConfigured(config)) {
      if (!firstError) {
        firstError = adapter.missingCredentialError
      }
      continue
    }

    const runtime = adapter.resolve(config)
    if (runtime) {
      return { runtime, triedProviders: preferredOrder }
    }
  }

  return {
    runtime: null,
    error: firstError,
    triedProviders: preferredOrder,
  }
}
