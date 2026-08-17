import {
  clearHelperBinding,
  getHelperBinding,
  getHelperSubscriptions,
  isHelperAuthError,
  putHelperSubscriptions,
  retryHelperEpisode,
  unpairHelper,
} from '../helper-client'
import type { HelperSyncClient } from './actions'

export const liveUnpair = async (serverId: string) => {
  const binding = getHelperBinding(serverId)
  if (!binding) {
    return
  }
  try {
    await unpairHelper(binding.url, binding.token)
  } catch (error) {
    if (isHelperAuthError(error)) {
      return
    }
    throw error
  }
}

export const liveRetry = async (input: {
  bangumiId: string
  episodeId: string
  serverId: string
  subgroupId: string
  title?: string
  torrentUrl?: string
}) => {
  const binding = getHelperBinding(input.serverId)
  if (!binding) {
    throw new Error('unbound')
  }
  await retryHelperEpisode(binding.url, binding.token, input)
}

export const liveHelperClient: HelperSyncClient = {
  async getSubscriptions(serverId) {
    const binding = getHelperBinding(serverId)
    if (!binding) {
      throw new Error('unbound')
    }
    try {
      return await getHelperSubscriptions(binding.url, binding.token)
    } catch (error) {
      if (isHelperAuthError(error)) {
        clearHelperBinding(serverId)
      }
      throw error
    }
  },
  async putSubscriptions(serverId, replicas, expectedRevision, options) {
    const binding = getHelperBinding(serverId)
    if (!binding) {
      throw new Error('unbound')
    }
    try {
      await putHelperSubscriptions(
        binding.url,
        binding.token,
        replicas,
        expectedRevision,
        options,
      )
    } catch (error) {
      if (isHelperAuthError(error)) {
        clearHelperBinding(serverId)
      }
      throw error
    }
  },
}
