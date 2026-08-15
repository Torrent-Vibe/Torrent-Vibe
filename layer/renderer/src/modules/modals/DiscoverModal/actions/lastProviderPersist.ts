import type { DiscoverProviderId } from '~/atoms/settings/discover'
import { DISCOVER_PROVIDER_IDS } from '~/atoms/settings/discover'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export const readLastProvider = (): DiscoverProviderId | null => {
  const value = storage.getItem(STORAGE_KEYS.DISCOVER_LAST_PROVIDER)
  if (value && (DISCOVER_PROVIDER_IDS as readonly string[]).includes(value)) {
    return value as DiscoverProviderId
  }
  return null
}

export const writeLastProvider = (providerId: DiscoverProviderId) => {
  storage.setItem(STORAGE_KEYS.DISCOVER_LAST_PROVIDER, providerId)
}
