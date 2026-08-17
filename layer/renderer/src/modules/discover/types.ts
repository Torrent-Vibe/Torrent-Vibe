import type {
  DiscoverProviderConfigMap,
  DiscoverProviderId,
} from '~/atoms/settings/discover'

export type DiscoverProviderConfig<T extends DiscoverProviderId> =
  DiscoverProviderConfigMap[T]

export type DiscoverPreviewDescriptionRenderer = 'markdown' | 'bbcode'

export type DiscoverItemEnrichmentStatus =
  'idle' | 'loading' | 'success' | 'error'

export interface DiscoverItemImdbEnrichment {
  actors?: string[]
  awards?: string | null
  countries?: string[]
  directors?: string[]
  fetchedAt: string
  genres?: string[]
  id: string
  languages?: string[]
  plot?: string | null
  posterUrl?: string | null
  rated?: string | null
  rating?: number | null
  releasedAt?: string | null
  runtimeMinutes?: number | null
  title?: string | null
  type?: string | null
  votes?: number | null
  writers?: string[]
  year?: number | null
}

export interface DiscoverItemImdbInfo {
  enrichment?: DiscoverItemImdbEnrichment | null
  enrichmentError?: string | null
  enrichmentStatus?: DiscoverItemEnrichmentStatus
  id?: string | null
  rating?: number | null
  url: string
}

export interface DiscoverItemDoubanInfo {
  rating?: number | null
  url: string
}

export interface DiscoverItemExternalRefs {
  [key: string]: unknown
  douban?: DiscoverItemDoubanInfo
  imdb?: DiscoverItemImdbInfo
}

export interface DiscoverItem {
  category?: string | null
  createdAt?: string | null
  discount?: string | null
  discountEndsAt?: string | null
  external?: DiscoverItemExternalRefs
  extra?: Record<string, unknown>
  id: string
  leechers?: number | null
  providerId: DiscoverProviderId
  raw?: unknown
  seeders?: number | null
  sizeBytes?: number | null
  snatches?: number | null
  synopsis?: string | null
  tags?: string[]
  title: string
}

export interface DiscoverItemDetail extends DiscoverItem {
  description?: string | null
  extra?: Record<string, unknown>
  files?: Array<{ name: string; sizeBytes?: number | null }>
  screenshots?: string[]
}

export interface DiscoverSearchParams {
  filters?: Record<string, unknown>
  keyword?: string
  page?: number
  pageSize?: number
  signal?: AbortSignal
}

export interface DiscoverSearchResponse<T = unknown> {
  hasMore?: boolean
  items: DiscoverItem[]
  page: number
  pageSize: number
  raw?: T
  total?: number | null
  totalPages?: number | null
}

export interface DiscoverDownloadParams {
  id: string
  item?: DiscoverItem
}

export interface DiscoverDownloadInfo {
  expiresAt?: string | null
  filename?: string | null
  raw?: unknown
  url: string
}

export type DiscoverFilterType = 'text' | 'select' | 'multi-select' | 'tags'

export interface DiscoverFilterOption {
  label: I18nKeysForSettings
  value: string
}

export interface DiscoverFilterDefinition {
  allowEmpty?: boolean
  defaultValue?: unknown
  description?: I18nKeysForSettings
  id: string
  label: I18nKeysForSettings
  options?: DiscoverFilterOption[]
  placeholder?: I18nKeysForSettings
  type: DiscoverFilterType
}

export interface DiscoverProviderImplementation<T extends DiscoverProviderId> {
  getDownloadUrl: (
    params: DiscoverDownloadParams,
    config: DiscoverProviderConfig<T>,
  ) => Promise<DiscoverDownloadInfo>
  getFilterDefinitions?: (
    config: DiscoverProviderConfig<T>,
  ) => DiscoverFilterDefinition[]
  getItemDetail?: (
    params: DiscoverDownloadParams,
    config: DiscoverProviderConfig<T>,
  ) => Promise<DiscoverItemDetail>
  id: T
  isConfigReady: (config: DiscoverProviderConfig<T>) => boolean
  label: string
  normalizeFilters?: (
    filters: Record<string, unknown>,
    config: DiscoverProviderConfig<T>,
  ) => Record<string, unknown>
  previewDescriptionRenderer?: DiscoverPreviewDescriptionRenderer
  search: (
    params: DiscoverSearchParams,
    config: DiscoverProviderConfig<T>,
  ) => Promise<DiscoverSearchResponse>
}

export type DiscoverProviderRegistry = {
  [K in DiscoverProviderId]: DiscoverProviderImplementation<K>
}

export type AnyDiscoverProvider = DiscoverProviderRegistry[DiscoverProviderId]
