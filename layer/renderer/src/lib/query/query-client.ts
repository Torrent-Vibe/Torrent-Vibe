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

        const status
          = error instanceof FetchError ? error.statusCode : undefined
        const message = error instanceof Error ? error.message : ''
        const isAuthError
          = status === 401
            || status === 403
            || /HTTP 401\b|HTTP 403\b|Unauthorized/i.test(message)

        if (isAuthError) {
          authManager.handle401Error().then((success) => {
            if (success) {
              queryClient.invalidateQueries()
            }
          })
          return false
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
