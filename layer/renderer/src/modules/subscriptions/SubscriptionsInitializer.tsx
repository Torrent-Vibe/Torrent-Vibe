import { useEffect } from 'react'

import { SubscriptionActions } from './actions'

export const SubscriptionsInitializer = () => {
  useEffect(() => {
    SubscriptionActions.shared.hydrate()
    void SubscriptionActions.shared.syncAll().then(() => {
      void SubscriptionActions.shared.refreshStatus()
    })
  }, [])

  return null
}
