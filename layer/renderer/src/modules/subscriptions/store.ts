import type { SubscriptionRecord } from '@torrent-vibe/helper-protocol'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createWithEqualityFn } from 'zustand/traditional'

import type {
  HelperJobStatus,
  HelperReplicaStatus,
} from '../helper-client/types'

export interface HelperStatusSnapshot {
  replicas: HelperReplicaStatus[]
  jobs: HelperJobStatus[]
  fetchedAt: string
  error?: string
}

export interface SubscriptionsState {
  items: SubscriptionRecord[]
  statusByServer: Record<string, HelperStatusSnapshot>
  syncing: boolean
}

const createInitialState = (): SubscriptionsState => ({
  items: [],
  statusByServer: {},
  syncing: false,
})

export const useSubscriptionsStore = createWithEqualityFn<SubscriptionsState>()(
  subscribeWithSelector(immer(() => createInitialState())),
)

export const subscriptionStore = {
  getState: () => useSubscriptionsStore.getState(),
  setState: (
    updater: SubscriptionsState | ((draft: SubscriptionsState) => void),
    replace = false,
  ) => {
    if (typeof updater === 'function') {
      if (replace) {
        useSubscriptionsStore.setState(updater, true)
      }
      else {
        useSubscriptionsStore.setState(updater)
      }
    }
    else {
      useSubscriptionsStore.setState(updater, true)
    }
  },
  reset: () => {
    useSubscriptionsStore.setState(createInitialState(), true)
  },
}
