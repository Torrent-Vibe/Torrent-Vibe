import type { QueryClient } from '@tanstack/react-query'

import type { QueryKeyCategory } from './query-keys'
import { QueryKeys } from './query-keys'

/**
 * Type for the invalidation handler created by Proxy
 * Maps each category and method to an async invalidation function
 */
type InvalidationHandler = {
  [K in keyof typeof QueryKeys]: {
    [M in keyof (typeof QueryKeys)[K]]: (
      ...args: Parameters<
        (typeof QueryKeys)[K][M] extends (...args: any[]) => any
          ? (typeof QueryKeys)[K][M]
          : never
      >
    ) => Promise<void>
  }
}

/**
 * Centralized Query Manager for qBittorrent client
 * Provides type-safe query invalidation and cache management using Proxy pattern
 */
export class QBQueryManager {
  private queryClient: QueryClient

  // Proxy-based invalidation methods - automatically generated
  public readonly invalidate: InvalidationHandler

  // Scenario-based methods for complex invalidation logic
  public readonly scenarios = {
    /**
     * Called when categories are modified (create, delete, edit)
     * Invalidates categories and related torrent data
     */
    onCategoryChange: async () => {
      await Promise.all([
        this.invalidate.categories.all(),
        this.invalidate.categories.withCounts(),
        this.invalidate.torrents.all(),
      ])
    },

    /**
     * Called when tags are modified (create, delete)
     * Invalidates tags and related torrent data
     */
    onTagChange: async () => {
      await Promise.all([
        this.invalidate.tags.all(),
        this.invalidate.tags.withCounts(),
        this.invalidate.torrents.all(),
      ])
    },

    /**
     * Called when torrent state changes (pause, resume, delete, etc.)
     * Optionally invalidates specific torrent details if hash is provided
     */
    onTorrentStateChange: async (hash?: string) => {
      const promises = [this.invalidate.torrents.all()]

      if (hash) {
        promises.push(
          this.invalidate.torrentDetails.all(hash),
          this.invalidate.torrentDetails.files(hash),
          this.invalidate.torrentDetails.peers(hash),
          this.invalidate.torrentDetails.trackers(hash),
          this.invalidate.torrentDetails.properties(hash),
          this.invalidate.torrentDetails.pieceStates(hash),
        )
      }

      await Promise.all(promises)
    },

    /**
     * Called when new torrents are added
     * Invalidates all torrent-related data including categories and tags
     */
    onTorrentAdded: async () => {
      await Promise.all([
        this.invalidate.torrents.all(),
        this.invalidate.categories.withCounts(),
        this.invalidate.tags.withCounts(),
      ])
    },

    /**
     * Called when qBittorrent preferences are updated
     */
    onPreferencesChange: async () => {
      await this.invalidate.qbittorrent.preferences()
    },

    /**
     * Called when connection/server changes
     * Invalidates ALL cached data since it belongs to different server
     */
    onConnectionChange: async () => {
      // Clear entire query cache since all data belongs to previous server
      this.queryClient.clear()
    },

    /**
     * Refresh all cached data - useful for manual refresh
     */
    refreshAll: async () => {
      await Promise.all([
        this.invalidate.torrents.all(),
        this.invalidate.categories.all(),
        this.invalidate.categories.withCounts(),
        this.invalidate.tags.all(),
        this.invalidate.tags.withCounts(),
        this.invalidate.qbittorrent.preferences(),
      ])
    },

    /**
     * Called when torrent category assignment changes
     * Optimized to only invalidate what's necessary
     */
    onTorrentCategoryAssignment: async () => {
      await Promise.all([
        this.invalidate.categories.withCounts(),
        this.invalidate.torrents.all(),
      ])
    },

    /**
     * Called when torrent tag assignment changes
     * Optimized to only invalidate what's necessary
     */
    onTorrentTagAssignment: async () => {
      await Promise.all([
        this.invalidate.tags.withCounts(),
        this.invalidate.torrents.all(),
      ])
    },
  }

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
    this.invalidate = this.createInvalidationProxy()
  }

  /**
   * Creates a Proxy that automatically generates invalidation methods
   * based on the QueryKeys structure
   */
  private createInvalidationProxy(): InvalidationHandler {
    return new Proxy({} as InvalidationHandler, {
      get: (target, categoryKey: string) => {
        if (!(categoryKey in QueryKeys)) {
          throw new Error(
            `Unknown query category: ${categoryKey}. Available categories: ${Object.keys(QueryKeys).join(', ')}`,
          )
        }

        return new Proxy(
          {},
          {
            get: (methodTarget, methodKey: string) => {
              const category = QueryKeys[categoryKey as keyof typeof QueryKeys]

              if (!(methodKey in category)) {
                const availableMethods = Object.keys(category).join(', ')
                throw new Error(
                  `Unknown query method: ${categoryKey}.${methodKey}. Available methods: ${availableMethods}`,
                )
              }

              const queryKeyFactory =
                category[methodKey as keyof typeof category]

              return async (...args: any[]) => {
                const queryKey = (queryKeyFactory as any)(...args)
                await this.queryClient.invalidateQueries({ queryKey })
              }
            },
          },
        )
      },
    })
  }

  // Utility methods for advanced cache management

  /**
   * Remove specific query data from cache without refetching
   */
  async removeFromCache(
    category: QueryKeyCategory,
    method: string,
    ...args: any[]
  ) {
    const categoryObj = QueryKeys[category]
    const queryKeyFactory = (categoryObj as any)[method]
    if (queryKeyFactory) {
      const queryKey = queryKeyFactory(...args)
      this.queryClient.removeQueries({ queryKey })
    }
  }

  /**
   * Prefetch data for better user experience
   */
  async prefetch(
    category: QueryKeyCategory,
    method: string,
    queryFn: () => Promise<any>,
    options: { staleTime?: number } = {},
    ...args: any[]
  ) {
    const categoryObj = QueryKeys[category]
    const queryKeyFactory = (categoryObj as any)[method]
    if (queryKeyFactory) {
      const queryKey = queryKeyFactory(...args)
      await this.queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: options.staleTime ?? 20000,
      })
    }
  }

  /**
   * Check if a specific query is currently loading
   */
  isQueryLoading(
    category: QueryKeyCategory,
    method: string,
    ...args: any[]
  ): boolean {
    const categoryObj = QueryKeys[category]
    const queryKeyFactory = (categoryObj as any)[method]
    if (queryKeyFactory) {
      const queryKey = queryKeyFactory(...args)
      return this.queryClient.isFetching({ queryKey }) > 0
    }
    return false
  }

  /**
   * Get cached data for a specific query
   */
  getQueryData<T>(
    category: QueryKeyCategory,
    method: string,
    ...args: any[]
  ): T | undefined {
    const categoryObj = QueryKeys[category]
    const queryKeyFactory = (categoryObj as any)[method]
    if (queryKeyFactory) {
      const queryKey = queryKeyFactory(...args)
      return this.queryClient.getQueryData(queryKey)
    }
    return undefined
  }

  /**
   * Set query data directly in cache
   */
  setQueryData<T>(
    category: QueryKeyCategory,
    method: string,
    data: T,
    ...args: any[]
  ): void {
    const categoryObj = QueryKeys[category]
    const queryKeyFactory = (categoryObj as any)[method]
    if (queryKeyFactory) {
      const queryKey = queryKeyFactory(...args)
      this.queryClient.setQueryData(queryKey, data)
    }
  }

  /**
   * Get query state information
   */
  getQueryState(category: QueryKeyCategory, method: string, ...args: any[]) {
    const categoryObj = QueryKeys[category]
    const queryKeyFactory = (categoryObj as any)[method]
    if (queryKeyFactory) {
      const queryKey = queryKeyFactory(...args)
      return this.queryClient.getQueryState(queryKey)
    }
    return
  }
}
