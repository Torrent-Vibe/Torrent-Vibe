import type { DiscoverFilterDefinition } from '~/modules/discover'

export type DiscoverFilterState = Record<string, unknown>

export interface DiscoverCommittedSearchState {
  keyword: string
  filters: DiscoverFilterState
  page: number
}

export interface DiscoverModalDerivedState {
  filterDefinitions: DiscoverFilterDefinition[]
}
