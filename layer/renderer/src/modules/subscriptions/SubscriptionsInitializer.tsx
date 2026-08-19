import { useEffect } from 'react'

import { listServerHelperTargets } from '../helper-client'
import { SubscriptionActions } from './actions'
import { ensureServerCapabilities } from './capability-cache'

export const SubscriptionsInitializer = () => {
  useEffect(() => {
    SubscriptionActions.shared.hydrate()
    void SubscriptionActions.shared.syncAll().then(() => {
      void SubscriptionActions.shared.refreshStatus()
    })
    void ensureServerCapabilities(
      listServerHelperTargets()
        .filter((target) => target.paired)
        .map((target) => target.id),
    )
  }, [])

  return null
}
