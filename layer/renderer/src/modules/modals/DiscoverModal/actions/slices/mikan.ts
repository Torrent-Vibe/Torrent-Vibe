import type { DiscoverItem } from '~/modules/discover'
import { asMikanBangumiExtra } from '~/modules/discover/providers/mikan/utils'
import { DiscoverService } from '~/modules/discover/service'

import {
  mikanBrowseBody,
  mikanDetailBangumiId,
  nextStackAfterBangumi,
  nextStackAfterSubscriptions,
  popMikanStack,
} from '../../mikan/stack'
import type { DiscoverActionContext } from '../context'
import {
  readLastMikanSubgroup,
  writeLastMikanSubgroup,
} from '../mikanLastSubgroup'
import { findItemById } from '../utils'

const pickSubgroupId = (
  bangumiId: string,
  subgroups: Array<{ id: string }>,
  preferred?: string | null,
) => {
  if (preferred && subgroups.some(group => group.id === preferred)) {
    return preferred
  }
  const remembered = readLastMikanSubgroup(bangumiId)
  if (remembered && subgroups.some(group => group.id === remembered)) {
    return remembered
  }
  return subgroups[0]?.id ?? null
}

const applyDetailPointer = (
  draft: {
    mikanStack: Parameters<typeof mikanDetailBangumiId>[0]
    mikanBangumiId: string | null
    mikanDetail: DiscoverItem | null
    mikanDetailLoading: boolean
    mikanDetailError: string | null
    mikanSubgroupId: string | null
  },
  previousBangumiId: string | null,
) => {
  const nextId = mikanDetailBangumiId(draft.mikanStack)
  draft.mikanBangumiId = nextId
  if (nextId !== previousBangumiId && nextId === null) {
    draft.mikanDetail = null
    draft.mikanDetailLoading = false
    draft.mikanDetailError = null
    draft.mikanSubgroupId = null
  }
}

export const createMikanSlice = (context: DiscoverActionContext) => {
  const loadBangumiDetail = async (id: string) => {
    const state = context.getState()
    if (!state.providerReady) {
      return
    }

    const requestId = context.mikan.nextToken()
    const item = findItemById(state.items, id) ?? state.mikanDetail ?? undefined

    context.setState((draft) => {
      if (draft.mikanBangumiId === id) {
        draft.mikanDetailLoading = true
        draft.mikanDetailError = null
      }
    })

    try {
      const detail = await DiscoverService.detail(state.activeProviderId, {
        id,
        item,
      })

      if (requestId !== context.mikan.currentToken()) {
        return
      }

      const extra = asMikanBangumiExtra(detail.extra)
      const subgroups = extra?.subgroups ?? []

      context.setState((draft) => {
        if (draft.mikanBangumiId !== id) {
          return
        }
        draft.mikanDetail = detail
        draft.mikanDetailLoading = false
        draft.mikanDetailError = null
        draft.mikanSubgroupId = pickSubgroupId(
          id,
          subgroups,
          draft.mikanSubgroupId,
        )
      })
    }
    catch (error) {
      console.error(error)
      if (requestId !== context.mikan.currentToken()) {
        return
      }

      context.setState((draft) => {
        if (draft.mikanBangumiId !== id) {
          return
        }
        draft.mikanDetailLoading = false
        draft.mikanDetailError = 'requestFailed'
      })
    }
  }

  const saveBrowseScroll = (scrollTop: number) => {
    context.setState((draft) => {
      if (draft.mikanStack.length > 0) {
        return
      }
      const key = mikanBrowseBody(draft.committedSearch?.keyword)
      draft.mikanBrowseScroll[key] = scrollTop
    })
  }

  const pushSubscriptions = () => {
    context.setState((draft) => {
      const previous = draft.mikanBangumiId
      draft.mikanStack = nextStackAfterSubscriptions(draft.mikanStack)
      applyDetailPointer(draft, previous)
    })
  }

  const pushBangumi = (item: DiscoverItem) => {
    const previous = context.getState().mikanBangumiId
    context.setState((draft) => {
      draft.mikanStack = nextStackAfterBangumi(draft.mikanStack, item.id)
      applyDetailPointer(draft, previous)
      if (draft.mikanBangumiId !== item.id) {
        return
      }
      draft.mikanDetail = item
      draft.mikanDetailLoading = true
      draft.mikanDetailError = null
      draft.mikanSubgroupId = readLastMikanSubgroup(item.id)
    })

    if (context.getState().mikanBangumiId === item.id) {
      void loadBangumiDetail(item.id)
    }
  }

  const popStack = () => {
    context.mikan.invalidate()
    context.setState((draft) => {
      const previous = draft.mikanBangumiId
      draft.mikanStack = popMikanStack(draft.mikanStack)
      applyDetailPointer(draft, previous)
    })
  }

  const selectSubgroup = (subgroupId: string) => {
    const state = context.getState()
    const bangumiId = state.mikanBangumiId
    if (!bangumiId) {
      return
    }

    writeLastMikanSubgroup(bangumiId, subgroupId)
    context.setState((draft) => {
      draft.mikanSubgroupId = subgroupId
    })
  }

  const retryBangumiDetail = () => {
    const { mikanBangumiId } = context.getState()
    if (!mikanBangumiId) {
      return
    }
    void loadBangumiDetail(mikanBangumiId)
  }

  return {
    saveBrowseScroll,
    pushSubscriptions,
    pushBangumi,
    popStack,
    selectSubgroup,
    retryBangumiDetail,
  }
}
