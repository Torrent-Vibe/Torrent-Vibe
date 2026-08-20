import type { HelperCapabilities } from './capabilities'

export type HelperLogTabId = 'events' | 'raw'
export type HelperLogTabState = 'available' | 'unavailable'

export const helperLogTabState = (
  tab: HelperLogTabId,
  capabilities: HelperCapabilities,
): HelperLogTabState => {
  const available = tab === 'events' ? capabilities.events : capabilities.logs
  return available ? 'available' : 'unavailable'
}

export const defaultHelperLogTab = (
  capabilities: HelperCapabilities,
): HelperLogTabId => {
  if (capabilities.events) {
    return 'events'
  }
  if (capabilities.logs) {
    return 'raw'
  }
  return 'events'
}
