import { createActionContext } from './context'
import { createEnrichmentSlice } from './slices/enrichment'
import { createFormSlice } from './slices/form'
import { createHistorySlice } from './slices/history'
import { createImportingSlice } from './slices/importing'
import { createMikanSlice } from './slices/mikan'
import { createPreviewSlice } from './slices/preview'
import { createProviderSlice } from './slices/provider'
import { createSearchSlice } from './slices/search'
import { createSelectionSlice } from './slices/selection'

const createDiscoverModalActions = () => {
  const context = createActionContext()

  const preview = createPreviewSlice(context)
  const provider = createProviderSlice(context)
  const form = createFormSlice(context)
  const history = createHistorySlice(context)
  const selection = createSelectionSlice(context, { preview })
  const search = createSearchSlice(context, { preview })
  const importing = createImportingSlice(context)
  const enrichment = createEnrichmentSlice(context)
  const mikan = createMikanSlice(context)

  const slices = {
    provider,
    form,
    search,
    history,
    selection,
    preview,
    importing,
    enrichment,
    mikan,
  } as const

  const actions = {
    ...provider,
    ...form,
    ...search,
    ...history,
    ...selection,
    ...preview,
    ...importing,
    ...enrichment,
    ...mikan,
  }

  return {
    ...actions,
    slices,
  }
}

export const DiscoverModalActions = {
  shared: createDiscoverModalActions(),
} as const

export type { ActionResult, ConfigureProviderOptions } from './types'
export type DiscoverModalActionSlices = ReturnType<
  typeof createDiscoverModalActions
>['slices']
