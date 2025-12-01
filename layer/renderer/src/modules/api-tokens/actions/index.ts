import { createActionContext } from './context'
import { createManageSlice } from './slices/manage'

const createApiTokenActions = () => {
  const context = createActionContext()
  const manage = createManageSlice(context)

  const slices = {
    manage,
  } as const

  return {
    ...manage,
    slices,
  }
}

export const ApiTokenActions = {
  shared: createApiTokenActions(),
} as const

export type ApiTokenActionSlices = ReturnType<
  typeof createApiTokenActions
>['slices']
