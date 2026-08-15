import type { DiscoverProviderId } from '~/atoms/settings/discover'

export const shouldResetMikanItems = (
  providerId: DiscoverProviderId,
  previousKeyword: string | null | undefined,
  nextKeyword: string,
) =>
  providerId === 'mikan'
  && Boolean(previousKeyword?.trim()) !== Boolean(nextKeyword.trim())
