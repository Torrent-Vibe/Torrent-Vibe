import { queryClient } from './query-client'
import { QBQueryManager } from './query-manager'

/**
 * Global instance of the QBQueryManager
 * This provides centralized query invalidation and cache management
 * for the entire qBittorrent client application
 */
export const qbQueryManager = new QBQueryManager(queryClient)

// Re-export commonly used items for convenience

export type { QueryKey, QueryKeyCategory } from './query-keys'
export { QueryKeys } from './query-keys'
export { QBQueryManager } from './query-manager'

/**
 * Utility function to get the query manager instance
 * Useful for dependency injection or testing
 */
export const getQueryManager = () => qbQueryManager

/**
 * Export for direct access to invalidation methods
 * Usage: invalidate.categories.all()
 */
export const { invalidate, scenarios } = qbQueryManager
