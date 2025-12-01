import { storage, STORAGE_KEYS } from './storage-keys'

export const AI_ENABLED_STORAGE_KEY = STORAGE_KEYS.APP.createKey(
  'ai-integration-enabled',
)

export function getAiIntegrationEnabled(defaultValue = true): boolean {
  const stored = storage.getJSON<boolean>(AI_ENABLED_STORAGE_KEY)
  return stored ?? defaultValue
}

export function setAiIntegrationEnabled(enabled: boolean): void {
  storage.setJSON(AI_ENABLED_STORAGE_KEY, enabled)
}
