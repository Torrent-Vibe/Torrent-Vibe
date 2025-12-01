import { createActionContext } from './context'
import { createFetchSlice } from './slices/fetch'

const createTorrentAiActions = () => {
  const context = createActionContext()
  const fetch = createFetchSlice(context)

  const slices = {
    fetch,
  } as const

  return {
    ...fetch,
    slices,
  }
}

export const TorrentAiActions = {
  shared: createTorrentAiActions(),
} as const

export type TorrentAiActionSlices = ReturnType<
  typeof createTorrentAiActions
>['slices']
