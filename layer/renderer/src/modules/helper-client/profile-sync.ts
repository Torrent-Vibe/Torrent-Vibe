import {
  getDiscoverConfig,
  type MikanProviderConfig,
  type MTeamProviderConfig,
  updateDiscoverProviderConfig,
} from '~/atoms/settings/discover'
import { API_TOKEN_SLOTS, ApiTokenActions } from '~/modules/api-tokens'

import type { HelperProfileRecord } from './types'

export const HELPER_PROFILE_GROUPS = [
  { id: 'mteam', keyPrefix: 'discover.mteam.' },
  { id: 'mikan', keyPrefix: 'discover.mikan.' },
  { id: 'openai', keyPrefix: 'ai.openai.' },
  { id: 'openrouter', keyPrefix: 'ai.openrouter.' },
  { id: 'codex', keyPrefix: 'ai.codex.' },
  { id: 'omdb', keyPrefix: 'discover.omdb.' },
  { id: 'tmdb', keyPrefix: 'metadata.tmdb.' },
] as const

export type HelperProfileGroupId = (typeof HELPER_PROFILE_GROUPS)[number]['id']

const localRecord = (
  key: string,
  value: string,
  secret = false,
): HelperProfileRecord => ({
  key,
  value,
  secret,
  updatedAt: '',
  updatedBy: '',
})

export const profileGroupForKey = (key: string): HelperProfileGroupId | null =>
  HELPER_PROFILE_GROUPS.find((group) => key.startsWith(group.keyPrefix))?.id ??
  null

export const profileRecordsInGroups = (
  records: HelperProfileRecord[],
  groups: ReadonlySet<HelperProfileGroupId>,
): HelperProfileRecord[] =>
  records.filter((record) => {
    const group = profileGroupForKey(record.key)
    return group !== null && groups.has(group)
  })

export const collectDesktopProfileRecords = async (): Promise<
  HelperProfileRecord[]
> => {
  const discover = getDiscoverConfig().providers
  const records = [
    localRecord('discover.mteam.enabled', String(discover.mteam.enabled)),
    localRecord('discover.mteam.displayName', discover.mteam.displayName),
    localRecord('discover.mteam.baseUrl', discover.mteam.baseUrl),
    localRecord('discover.mteam.mode', discover.mteam.mode ?? 'normal'),
    localRecord('discover.mteam.pageSize', String(discover.mteam.pageSize)),
    localRecord('discover.mikan.enabled', String(discover.mikan.enabled)),
    localRecord('discover.mikan.displayName', discover.mikan.displayName),
    localRecord('discover.mikan.baseUrl', discover.mikan.baseUrl),
    localRecord('discover.mikan.pageSize', String(discover.mikan.pageSize)),
  ]

  if (discover.mteam.apiKey.trim()) {
    records.push(
      localRecord('discover.mteam.apiKey', discover.mteam.apiKey.trim(), true),
    )
  }

  const tokenRecords = await Promise.all(
    API_TOKEN_SLOTS.map(async (definition) => {
      const value = await ApiTokenActions.shared.getTokenValue(definition.id)
      if (!value) {
        return null
      }
      const secret =
        definition.inputType === undefined ||
        definition.inputType === 'password'
      return localRecord(definition.id, value, secret)
    }),
  )
  records.push(
    ...tokenRecords.filter(
      (record): record is HelperProfileRecord => record !== null,
    ),
  )
  return records
}

const recordMap = (records: HelperProfileRecord[]) =>
  new Map(records.map((record) => [record.key, record.value]))

const stringValue = (
  records: Map<string, string>,
  key: string,
): string | undefined => records.get(key)

const booleanValue = (
  records: Map<string, string>,
  key: string,
): boolean | undefined => {
  const value = records.get(key)
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const positiveIntegerValue = (
  records: Map<string, string>,
  key: string,
): number | undefined => {
  const value = Number(records.get(key))
  return Number.isInteger(value) && value > 0 ? value : undefined
}

export const applyDesktopProfileRecords = async (
  records: HelperProfileRecord[],
): Promise<number> => {
  const values = recordMap(records)
  let applied = 0

  const mteamPatch: Partial<MTeamProviderConfig> = {}
  const mteamEnabled = booleanValue(values, 'discover.mteam.enabled')
  const mteamDisplayName = stringValue(values, 'discover.mteam.displayName')
  const mteamBaseURL = stringValue(values, 'discover.mteam.baseUrl')
  const mteamMode = stringValue(values, 'discover.mteam.mode')
  const mteamPageSize = positiveIntegerValue(values, 'discover.mteam.pageSize')
  const mteamAPIKey = stringValue(values, 'discover.mteam.apiKey')
  if (mteamEnabled !== undefined) mteamPatch.enabled = mteamEnabled
  if (mteamDisplayName !== undefined) mteamPatch.displayName = mteamDisplayName
  if (mteamBaseURL !== undefined) mteamPatch.baseUrl = mteamBaseURL
  if (mteamMode !== undefined) mteamPatch.mode = mteamMode
  if (mteamPageSize !== undefined) mteamPatch.pageSize = mteamPageSize
  if (mteamAPIKey !== undefined) mteamPatch.apiKey = mteamAPIKey
  if (Object.keys(mteamPatch).length > 0) {
    updateDiscoverProviderConfig('mteam', mteamPatch)
    applied += Object.keys(mteamPatch).length
  }

  const mikanPatch: Partial<MikanProviderConfig> = {}
  const mikanEnabled = booleanValue(values, 'discover.mikan.enabled')
  const mikanDisplayName = stringValue(values, 'discover.mikan.displayName')
  const mikanBaseURL = stringValue(values, 'discover.mikan.baseUrl')
  const mikanPageSize = positiveIntegerValue(values, 'discover.mikan.pageSize')
  if (mikanEnabled !== undefined) mikanPatch.enabled = mikanEnabled
  if (mikanDisplayName !== undefined) mikanPatch.displayName = mikanDisplayName
  if (mikanBaseURL !== undefined) mikanPatch.baseUrl = mikanBaseURL
  if (mikanPageSize !== undefined) mikanPatch.pageSize = mikanPageSize
  if (Object.keys(mikanPatch).length > 0) {
    updateDiscoverProviderConfig('mikan', mikanPatch)
    applied += Object.keys(mikanPatch).length
  }

  for (const definition of API_TOKEN_SLOTS) {
    const value = values.get(definition.id)
    if (value === undefined) {
      continue
    }
    const result = await ApiTokenActions.shared.setTokenValue(
      definition.id,
      value,
    )
    if (result.ok) {
      applied += 1
    }
  }
  return applied
}
