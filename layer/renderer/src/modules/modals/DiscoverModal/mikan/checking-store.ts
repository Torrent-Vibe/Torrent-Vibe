import { subscribeWithSelector } from 'zustand/middleware'
import { createWithEqualityFn } from 'zustand/traditional'

export const useCheckingSubscriptionsStore = createWithEqualityFn<{
  checkingKeys: Record<string, boolean>
}>()(
  subscribeWithSelector(() => ({
    checkingKeys: {},
  })),
)

export const setSubscriptionChecking = (
  key: string,
  checking: boolean,
): void => {
  useCheckingSubscriptionsStore.setState((state) => {
    if (!checking) {
      if (!(key in state.checkingKeys)) {
        return state
      }
      const next = Object.fromEntries(
        Object.entries(state.checkingKeys).filter(([entry]) => entry !== key),
      )
      return { checkingKeys: next }
    }
    return { checkingKeys: { ...state.checkingKeys, [key]: true } }
  })
}

export const isSubscriptionChecking = (key: string): boolean =>
  Boolean(useCheckingSubscriptionsStore.getState().checkingKeys[key])
