import type { DiscoverFilterDefinition } from '~/modules/discover'

export type DiscoverFilterState = Record<string, unknown>

export interface DiscoverCommittedSearchState {
  filters: DiscoverFilterState
  keyword: string
  page: number
}

export interface DiscoverModalDerivedState {
  filterDefinitions: DiscoverFilterDefinition[]
}
