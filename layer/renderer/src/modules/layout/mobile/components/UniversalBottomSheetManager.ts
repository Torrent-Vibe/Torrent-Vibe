import { atom } from 'jotai'

import { jotaiStore } from '~/lib/jotai'

import type {
  BottomSheetComponent,
  BottomSheetContentConfig,
  BottomSheetItem,
} from './types'

export const bottomSheetItemsAtom = atom<BottomSheetItem[]>([])

const bottomSheetCloseRegistry = new Map<string, () => void>()

export const BottomSheet = {
  present<P = unknown>(
    Component: BottomSheetComponent<P>,
    props?: P,
    contentConfig?: BottomSheetContentConfig,
  ): string {
    const id = `sheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const items = jotaiStore.get(bottomSheetItemsAtom)
    jotaiStore.set(bottomSheetItemsAtom, [
      ...items,
      {
        id,
        component: Component as BottomSheetComponent<any>,
        props,
        contentConfig,
      },
    ])
    return id
  },

  dismiss(id: string): void {
    const closer = bottomSheetCloseRegistry.get(id)
    if (closer) {
      closer()
      return
    }
    // Fallback: remove immediately if closer not registered yet
    const items = jotaiStore.get(bottomSheetItemsAtom)
    jotaiStore.set(
      bottomSheetItemsAtom,
      items.filter((item) => item.id !== id),
    )
  },

  dismissAll(): void {
    jotaiStore.set(bottomSheetItemsAtom, [])
    bottomSheetCloseRegistry.clear()
  },

  /** Internal: used by container to manage close hooks */
  __registerCloser(id: string, fn: () => void) {
    bottomSheetCloseRegistry.set(id, fn)
  },
  __unregisterCloser(id: string) {
    bottomSheetCloseRegistry.delete(id)
  },
}

export { type BottomSheetItem } from './types'
