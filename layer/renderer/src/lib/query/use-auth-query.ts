import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'

import { useShouldDisableQueries } from '~/modules/connection/atoms/connection'

/**
 * Authentication-aware query hook that automatically disables queries
 * when authentication has failed or connection is down
 */
export function useAuthQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends readonly unknown[] = readonly unknown[],
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): UseQueryResult<TData, TError> {
  const shouldDisable = useShouldDisableQueries()

  return useQuery({
    ...options,
    enabled: shouldDisable ? false : options.enabled,
    retry: false,
  })
}
