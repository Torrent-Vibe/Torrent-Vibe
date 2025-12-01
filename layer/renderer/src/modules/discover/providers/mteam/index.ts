import type { DiscoverProviderId } from '~/atoms/settings/discover'

import type {
  DiscoverFilterDefinition,
  DiscoverProviderImplementation,
} from '../../types'
import { getItemDetail } from './detail'
import { getDownloadUrl } from './download'
import {
  MTEAM_FILTER_DEFINITIONS,
  MTeamFilterType,
} from './filters'
import { search } from './search'
import { ensureConfigReady } from './utils'

export const MTeamDiscoverProvider: DiscoverProviderImplementation<'mteam'> = {
  id: 'mteam',
  label: 'M-Team 馒头',
  previewDescriptionRenderer: 'bbcode',
  isConfigReady: (config) => {
    try {
      ensureConfigReady(config)
      return true
    } catch {
      return false
    }
  },
  search,
  getItemDetail,
  getDownloadUrl,
  getFilterDefinitions: (config) => {
    return MTEAM_FILTER_DEFINITIONS.map(
      (definition): DiscoverFilterDefinition => {
        if (definition.id === 'mode') {
          return {
            ...definition,
            defaultValue: config.mode ?? MTeamFilterType.TV,
          }
        }
        if (definition.id === 'categories') {
          return {
            ...definition,
            defaultValue: undefined,
          }
        }
        if (definition.id === 'discount') {
          return {
            ...definition,
            defaultValue: 'any',
          }
        }
        return definition
      },
    )
  },
  normalizeFilters: (filters, config) => {
    return {
      ...filters,
      mode:
        (typeof filters.mode === 'string' && filters.mode.trim()) ||
        config.mode ||
        MTeamFilterType.TV,
    }
  },
}



export type MTeamProviderId = Extract<DiscoverProviderId, 'mteam'>

export {MTEAM_FILTER_DEFINITIONS_MODES} from './filters'