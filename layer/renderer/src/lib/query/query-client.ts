import { QueryClient } from '@tanstack/react-query'
import { FetchError } from 'ofetch'

import { authManager } from '~/modules/connection/auth-manager'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      retryDelay: 1000,
      retry(failureCount, error) {
        console.error(error)

        // Handle 401 Unauthorized errors
        if (error instanceof FetchError && error.statusCode === 401) {
          // Attempt auth refresh on 401
          authManager.handle401Error().then((success) => {
            if (success) {
              // Invalidate all queries to retry after successful auth
              queryClient.invalidateQueries()
            }
          })
          return false // Don't retry immediately, wait for auth refresh
        }

        if (error instanceof FetchError && error.statusCode === undefined) {
          return false
        }

        return !!(3 - failureCount)
      },
      // throwOnError: import.meta.env.DEV,
    },
  },
})

export { queryClient }
