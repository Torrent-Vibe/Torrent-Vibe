import type {
  DiscoverProviderConfigMap,
  DiscoverProviderId,
} from '~/atoms/settings/discover'

export type DiscoverProviderConfig<T extends DiscoverProviderId> =
  DiscoverProviderConfigMap[T]

export type DiscoverPreviewDescriptionRenderer = 'markdown' | 'bbcode'

export type DiscoverItemEnrichmentStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'

export interface DiscoverItemImdbEnrichment {
  id: string
  title?: string | null
  year?: number | null
  rating?: number | null
  votes?: number | null
  runtimeMinutes?: number | null
  genres?: string[]
  plot?: string | null
  posterUrl?: string | null
  releasedAt?: string | null
  rated?: string | null
  type?: string | null
  languages?: string[]
  countries?: string[]
  awards?: string | null
  directors?: string[]
  writers?: string[]
  actors?: string[]
  fetchedAt: string
}

export interface DiscoverItemImdbInfo {
  url: string
  id?: string | null
  rating?: number | null
  enrichment?: DiscoverItemImdbEnrichment | null
  enrichmentStatus?: DiscoverItemEnrichmentStatus
  enrichmentError?: string | null
}

export interface DiscoverItemDoubanInfo {
  url: string
  rating?: number | null
}

export interface DiscoverItemExternalRefs {
  imdb?: DiscoverItemImdbInfo
  douban?: DiscoverItemDoubanInfo
  [key: string]: unknown
}

export interface DiscoverItem {
  id: string
  providerId: DiscoverProviderId
  title: string
  sizeBytes?: number | null
  createdAt?: string | null
  seeders?: number | null
  leechers?: number | null
  snatches?: number | null
  discount?: string | null
  discountEndsAt?: string | null
  category?: string | null
  tags?: string[]
  synopsis?: string | null
  external?: DiscoverItemExternalRefs
  raw?: unknown
  extra?: Record<string, unknown>
}

export interface DiscoverItemDetail extends DiscoverItem {
  description?: string | null
  files?: Array<{ name: string; sizeBytes?: number | null }>
  screenshots?: string[]
  extra?: Record<string, unknown>
}

export interface DiscoverSearchParams {
  keyword?: string
  page?: number
  pageSize?: number
  filters?: Record<string, unknown>
  signal?: AbortSignal
}

export interface DiscoverSearchResponse<T = unknown> {
  items: DiscoverItem[]
  total?: number | null
  page: number
  pageSize: number
  hasMore?: boolean
  raw?: T
  totalPages?: number | null
}

export interface DiscoverDownloadParams {
  id: string
  item?: DiscoverItem
}

export interface DiscoverDownloadInfo {
  url: string
  expiresAt?: string | null
  filename?: string | null
  raw?: unknown
}

export type DiscoverFilterType = 'text' | 'select' | 'multi-select' | 'tags'

export interface DiscoverFilterOption {
  value: string
  label: I18nKeysForSettings
}

export interface DiscoverFilterDefinition {
  id: string
  type: DiscoverFilterType
  label: I18nKeysForSettings
  placeholder?: I18nKeysForSettings
  description?: I18nKeysForSettings
  options?: DiscoverFilterOption[]
  defaultValue?: unknown
  allowEmpty?: boolean
}

export interface DiscoverProviderImplementation<T extends DiscoverProviderId> {
  id: T
  label: string
  previewDescriptionRenderer?: DiscoverPreviewDescriptionRenderer
  isConfigReady: (config: DiscoverProviderConfig<T>) => boolean
  search: (
    params: DiscoverSearchParams,
    config: DiscoverProviderConfig<T>,
  ) => Promise<DiscoverSearchResponse>
  getItemDetail?: (
    params: DiscoverDownloadParams,
    config: DiscoverProviderConfig<T>,
  ) => Promise<DiscoverItemDetail>
  getDownloadUrl: (
    params: DiscoverDownloadParams,
    config: DiscoverProviderConfig<T>,
  ) => Promise<DiscoverDownloadInfo>
  getFilterDefinitions?: (
    config: DiscoverProviderConfig<T>,
  ) => DiscoverFilterDefinition[]
  normalizeFilters?: (
    filters: Record<string, unknown>,
    config: DiscoverProviderConfig<T>,
  ) => Record<string, unknown>
}

export type AnyDiscoverProvider =
  DiscoverProviderImplementation<DiscoverProviderId>
