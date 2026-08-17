import { atom } from 'jotai'

import { createAtomHooks } from '~/lib/jotai'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export const DISCOVER_PROVIDER_IDS = ['mteam', 'mikan'] as const

export type DiscoverProviderId = (typeof DISCOVER_PROVIDER_IDS)[number]

export interface BaseDiscoverProviderConfig {
  displayName: string
  enabled: boolean
  id: DiscoverProviderId
}

export interface MTeamProviderConfig extends BaseDiscoverProviderConfig {
  apiKey: string
  baseUrl: string
  id: 'mteam'
  mode?: string
  pageSize: number
}

export interface MikanProviderConfig extends BaseDiscoverProviderConfig {
  baseUrl: string
  displayName: string
  enabled: boolean
  id: 'mikan'
  pageSize: number
}

export type DiscoverProviderConfigMap = {
  mteam: MTeamProviderConfig
  mikan: MikanProviderConfig
}

export type DiscoverProviderConfigState = {
  providers: DiscoverProviderConfigMap
}

const DEFAULT_CONFIG: DiscoverProviderConfigState = {
  providers: {
    mteam: {
      id: 'mteam',
      displayName: 'M-Team 馒头',
      enabled: false,
      baseUrl: 'https://api.m-team.cc/api',
      apiKey: '',
      mode: 'normal',
      pageSize: 20,
    },
    mikan: {
      id: 'mikan',
      displayName: 'Mikan 蜜柑计划',
      enabled: false,
      baseUrl: 'https://mikanani.me',
      pageSize: 50,
    },
  },
}

const loadInitialConfig = (): DiscoverProviderConfigState => {
  const stored = storage.getJSON<Partial<DiscoverProviderConfigState>>(
    STORAGE_KEYS.DISCOVER_PROVIDERS,
  )

  if (!stored) {
    return DEFAULT_CONFIG
  }

  const merged: DiscoverProviderConfigState = {
    providers: {
      mteam: {
        ...DEFAULT_CONFIG.providers.mteam,
        ...stored.providers?.mteam,
      },
      mikan: {
        ...DEFAULT_CONFIG.providers.mikan,
        ...stored.providers?.mikan,
      },
    },
  }

  return merged
}

const saveConfig = (config: DiscoverProviderConfigState) => {
  storage.setJSON(STORAGE_KEYS.DISCOVER_PROVIDERS, config)
}

const discoverConfigAtom = atom(loadInitialConfig())

const [
  ,
  useDiscoverConfigState,
  useDiscoverConfigValue,
  useSetDiscoverConfigState,
  getDiscoverConfig,
  setDiscoverConfig,
] = createAtomHooks(discoverConfigAtom)

export const useDiscoverProvidersConfig = useDiscoverConfigValue
export const useDiscoverProviderConfig = <T extends DiscoverProviderId>(
  id: T,
): DiscoverProviderConfigMap[T] => {
  const config = useDiscoverConfigValue()
  return config.providers[id]
}

export const updateDiscoverProviderConfig = <T extends DiscoverProviderId>(
  id: T,
  updater:
    | Partial<DiscoverProviderConfigMap[T]>
    | ((prev: DiscoverProviderConfigMap[T]) => DiscoverProviderConfigMap[T]),
) => {
  const prev = getDiscoverConfig()
  const current = prev.providers[id]
  const next =
    typeof updater === 'function'
      ? (
          updater as (
            p: DiscoverProviderConfigMap[T],
          ) => DiscoverProviderConfigMap[T]
        )(current)
      : { ...current, ...updater }

  const updated: DiscoverProviderConfigState = {
    providers: {
      ...prev.providers,
      [id]: { ...current, ...next },
    },
  }

  saveConfig(updated)
  setDiscoverConfig(updated)
}

export const resetDiscoverProvidersConfig = () => {
  saveConfig(DEFAULT_CONFIG)
  setDiscoverConfig(DEFAULT_CONFIG)
}

export const getDiscoverProviderConfig = <T extends DiscoverProviderId>(
  id: T,
): DiscoverProviderConfigMap[T] => {
  return getDiscoverConfig().providers[id]
}

export const useDiscoverProviderEnabled = <T extends DiscoverProviderId>(
  id: T,
): boolean => {
  const config = useDiscoverProviderConfig(id)
  return config.enabled
}

export const setDiscoverProviderEnabled = <T extends DiscoverProviderId>(
  id: T,
  enabled: boolean,
) => {
  updateDiscoverProviderConfig(id, (prev) => ({ ...prev, enabled }))
}

export {
  getDiscoverConfig,
  useDiscoverConfigState,
  useDiscoverConfigValue,
  useSetDiscoverConfigState,
}
