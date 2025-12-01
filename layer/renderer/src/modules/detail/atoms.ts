import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import { createAtomHooks } from '~/lib/jotai'

// Detail panel state
export const detailPanelVisibleAtom = atom<boolean>(false)
export const detailPanelWidthAtom = atomWithStorage<number>(
  'detailPanelWidth',
  320,
  undefined,
  { getOnInit: true },
)
export const detailPanelFloatingAtom = atomWithStorage<boolean>(
  'detailPanelFloating',
  false,
  undefined,
  { getOnInit: true },
)
export const detailPanelFloatingWidthAtom = atomWithStorage<number>(
  'detailPanelFloatingWidth',
  380,
  undefined,
  { getOnInit: true },
)
export const detailPanelFloatingHeightAtom = atomWithStorage<number>(
  'detailPanelFloatingHeight',
  450,
  undefined,
  { getOnInit: true },
)

// Create hooks for all atoms
export const [
  detailPanelVisibleAtomInternal,
  useDetailPanelVisible,
  useDetailPanelVisibleValue,
  useSetDetailPanelVisible,
] = createAtomHooks(detailPanelVisibleAtom)

export const [
  detailPanelWidthAtomInternal,
  useDetailPanelWidth,
  useDetailPanelWidthValue,
  useSetDetailPanelWidth,
] = createAtomHooks(detailPanelWidthAtom)

export const [
  detailPanelFloatingAtomInternal,
  useDetailPanelFloating,
  useDetailPanelFloatingValue,
  useSetDetailPanelFloating,
] = createAtomHooks(detailPanelFloatingAtom)

export const [
  detailPanelFloatingWidthAtomInternal,
  useDetailPanelFloatingWidth,
  useDetailPanelFloatingWidthValue,
  useSetDetailPanelFloatingWidth,
] = createAtomHooks(detailPanelFloatingWidthAtom)

export const [
  detailPanelFloatingHeightAtomInternal,
  useDetailPanelFloatingHeight,
  useDetailPanelFloatingHeightValue,
  useSetDetailPanelFloatingHeight,
] = createAtomHooks(detailPanelFloatingHeightAtom)
