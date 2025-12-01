import { atom } from 'jotai'

import { DEFAULT_MOBILE_FIELDS } from '../constants/mobile-fields'
import type { MobileCellConfig } from '../types'

// Mobile layout state for managing mobile-specific UI interactions
export interface MobileLayoutState {
  // Navigation drawer state (hamburger menu)
  drawerOpen: boolean

  // Search expansion state in mobile toolbar
  searchExpanded: boolean

  // Bottom sheet state for torrent details
  bottomSheetOpen: boolean

  // Currently selected card hash for detail view
  selectedCard: string | null

  // Set of expanded card hashes for collapsible card sections
  expandedCards: Set<string>

  // Multi-select mode state (activated by long press)
  multiSelectMode: boolean

  // Gesture interaction state
  gestureInteractionActive: boolean
}

// Main mobile layout atom
export const mobileLayoutAtom = atom<MobileLayoutState>({
  drawerOpen: false,
  searchExpanded: false,
  bottomSheetOpen: false,
  selectedCard: null,
  expandedCards: new Set<string>(),
  multiSelectMode: false,
  gestureInteractionActive: false,
})

// Derived atoms for specific UI interactions
export const drawerOpenAtom = atom(
  (get) => get(mobileLayoutAtom).drawerOpen,
  (get, set, open: boolean) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, drawerOpen: open })
  },
)

export const searchExpandedAtom = atom(
  (get) => get(mobileLayoutAtom).searchExpanded,
  (get, set, expanded: boolean) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, searchExpanded: expanded })
  },
)

export const bottomSheetOpenAtom = atom(
  (get) => get(mobileLayoutAtom).bottomSheetOpen,
  (get, set, open: boolean) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, bottomSheetOpen: open })
  },
)

export const selectedCardAtom = atom(
  (get) => get(mobileLayoutAtom).selectedCard,
  (get, set, cardHash: string | null) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, selectedCard: cardHash })
  },
)

export const multiSelectModeAtom = atom(
  (get) => get(mobileLayoutAtom).multiSelectMode,
  (get, set, enabled: boolean) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, multiSelectMode: enabled })
  },
)

// Card expansion management
export const expandedCardsAtom = atom(
  (get) => get(mobileLayoutAtom).expandedCards,
  (get, set, cards: Set<string>) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, expandedCards: new Set(cards) })
  },
)

// Action atoms for card expansion
export const toggleCardExpansionAtom = atom(
  null,
  (get, set, cardHash: string) => {
    const current = get(mobileLayoutAtom)
    const expandedCards = new Set(current.expandedCards)

    if (expandedCards.has(cardHash)) {
      expandedCards.delete(cardHash)
    } else {
      expandedCards.add(cardHash)
    }

    set(mobileLayoutAtom, { ...current, expandedCards })
  },
)

export const collapseAllCardsAtom = atom(null, (get, set) => {
  const current = get(mobileLayoutAtom)
  set(mobileLayoutAtom, { ...current, expandedCards: new Set<string>() })
})

// Gesture state management
export const gestureInteractionActiveAtom = atom(
  (get) => get(mobileLayoutAtom).gestureInteractionActive,
  (get, set, active: boolean) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, { ...current, gestureInteractionActive: active })
  },
)

// Utility atom to check if card is expanded
export const isCardExpandedAtom = atom(null, (get, _set, cardHash: string) => {
  const { expandedCards } = get(mobileLayoutAtom)
  return expandedCards.has(cardHash)
})

// Action atom to open detail bottom sheet with selected card
export const openDetailBottomSheetAtom = atom(
  null,
  (get, set, cardHash: string) => {
    const current = get(mobileLayoutAtom)
    set(mobileLayoutAtom, {
      ...current,
      selectedCard: cardHash,
      bottomSheetOpen: true,
    })
  },
)

// Action atom to close detail bottom sheet
export const closeDetailBottomSheetAtom = atom(null, (get, set) => {
  const current = get(mobileLayoutAtom)
  set(mobileLayoutAtom, {
    ...current,
    selectedCard: null,
    bottomSheetOpen: false,
  })
})

// Reset mobile layout state (useful for cleanup)
export const resetMobileLayoutAtom = atom(null, (get, set) => {
  set(mobileLayoutAtom, {
    drawerOpen: false,
    searchExpanded: false,
    bottomSheetOpen: false,
    selectedCard: null,
    expandedCards: new Set<string>(),
    multiSelectMode: false,
    gestureInteractionActive: false,
  })
})

// Mobile cell configuration
export const mobileCellConfigAtom = atom<MobileCellConfig>({
  fields: DEFAULT_MOBILE_FIELDS,
  layout: 'compact',
  showProgress: true,
  showSeparator: true,
})
