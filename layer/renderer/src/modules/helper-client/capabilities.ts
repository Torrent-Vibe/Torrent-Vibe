export interface HelperCapabilities {
  check: boolean
  events: boolean
  logs: boolean
}

export const helperCapabilities = (
  capabilities: string[] | null | undefined,
): HelperCapabilities => {
  const set = new Set(Array.isArray(capabilities) ? capabilities : [])
  return {
    events: set.has('events'),
    logs: set.has('logs'),
    check: set.has('check'),
  }
}
