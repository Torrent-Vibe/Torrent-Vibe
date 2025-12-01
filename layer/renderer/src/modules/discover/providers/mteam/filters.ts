import type {
  DiscoverFilterDefinition,
  DiscoverFilterOption,
} from '../../types'

export enum MTeamFilterType {
  TV = 'tvshow',

  MUSIC = 'music',
  ADULT = 'adult',
  NORMAL = 'normal',
  MOVIE = 'movie',
}

export const MTEAM_FILTER_DEFINITIONS_MODES: DiscoverFilterOption[] = [
  {
    value: MTeamFilterType.NORMAL,
    label: 'discover.providers.mteam.mode.normal',
  },
  {
    value: MTeamFilterType.MOVIE,
    label: 'discover.providers.mteam.mode.movie',
  },
  {
    value: MTeamFilterType.MUSIC,
    label: 'discover.providers.mteam.mode.music',
  },
  {
    value: MTeamFilterType.ADULT,
    label: 'discover.providers.mteam.mode.adult',
  },
  { value: MTeamFilterType.TV, label: 'discover.providers.mteam.mode.tv' },
]

export const MTEAM_FILTER_DEFINITIONS: DiscoverFilterDefinition[] = [
  {
    id: 'mode',
    type: 'select' as const,
    label: 'discover.filters.mteam.mode.label',
    options: MTEAM_FILTER_DEFINITIONS_MODES,
  },
  {
    id: 'discount',
    type: 'select' as const,
    label: 'discover.filters.mteam.discount.label',
    options: [
      { value: 'any', label: 'discover.filters.common.any' },
      { value: 'FREE', label: 'discover.filters.mteam.discount.free' },
      {
        value: 'PERCENT_50',
        label: 'discover.filters.mteam.discount.percent50',
      },
      {
        value: 'PERCENT_30',
        label: 'discover.filters.mteam.discount.percent30',
      },
      { value: '_2X', label: 'discover.filters.mteam.discount.double' },
      {
        value: '_2X_FREE',
        label: 'discover.filters.mteam.discount.doubleFree',
      },
      {
        value: '_2X_PERCENT_50',
        label: 'discover.filters.mteam.discount.doubleHalf',
      },
    ],
  },
  {
    id: 'categories',
    type: 'tags' as const,
    label: 'discover.filters.mteam.categories.label',
    placeholder: 'discover.filters.mteam.categories.placeholder',
  },
]
