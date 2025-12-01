import { atom } from 'jotai'

import { createAtomHooks } from '~/lib/jotai'
import { storage, STORAGE_KEYS } from '~/lib/storage-keys'

export type AccentColorId =
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'graphite'

export type AppColorStyle = 'default' | 'low' | 'high'

export interface AccentColorPreset {
  id: AccentColorId
  labelKey: I18nKeysForSettings
  lightColor: string
  darkColor: string
}

export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  {
    id: 'blue',
    labelKey: 'general.appearance.accent.presets.blue',
    lightColor: '#0A84FF',
    darkColor: '#409CFF',
  },
  {
    id: 'purple',
    labelKey: 'general.appearance.accent.presets.purple',
    lightColor: '#BF5AF2',
    darkColor: '#D6A2FF',
  },
  {
    id: 'pink',
    labelKey: 'general.appearance.accent.presets.pink',
    lightColor: '#FF2D55',
    darkColor: '#FF6585',
  },
  {
    id: 'red',
    labelKey: 'general.appearance.accent.presets.red',
    lightColor: '#FF453A',
    darkColor: '#FF6F66',
  },
  {
    id: 'orange',
    labelKey: 'general.appearance.accent.presets.orange',
    lightColor: '#FF9F0A',
    darkColor: '#FFB441',
  },
  {
    id: 'yellow',
    labelKey: 'general.appearance.accent.presets.yellow',
    lightColor: '#FFD60A',
    darkColor: '#FFE066',
  },
  {
    id: 'green',
    labelKey: 'general.appearance.accent.presets.green',
    lightColor: '#30D158',
    darkColor: '#63E87A',
  },
  {
    id: 'graphite',
    labelKey: 'general.appearance.accent.presets.graphite',
    lightColor: '#8E8E93',
    darkColor: '#A0A0A6',
  },
]

export const ACCENT_COLOR_PRESET_MAP: Record<AccentColorId, AccentColorPreset> =
  ACCENT_COLOR_PRESETS.reduce(
    (map, preset) => ({
      ...map,
      [preset.id]: preset,
    }),
    {} as Record<AccentColorId, AccentColorPreset>,
  )

export const DEFAULT_ACCENT_COLOR: AccentColorId = 'blue'
export const DEFAULT_COLOR_STYLE: AppColorStyle = 'default'

const ACCENT_STORAGE_KEY = STORAGE_KEYS.ACCENT_COLOR
const COLOR_STYLE_STORAGE_KEY = STORAGE_KEYS.COLOR_STYLE

const loadAccentColor = (): AccentColorId => {
  const stored = storage.getItem(ACCENT_STORAGE_KEY) as AccentColorId | null
  return stored && stored in ACCENT_COLOR_PRESET_MAP
    ? stored
    : DEFAULT_ACCENT_COLOR
}

const loadColorStyle = (): AppColorStyle => {
  const stored = storage.getItem(COLOR_STYLE_STORAGE_KEY)

  let resolved: AppColorStyle = DEFAULT_COLOR_STYLE

  switch (stored) {
  case 'high': 
  case 'high-contrast': {
    resolved = 'high'
  
  break;
  }
  case 'low': 
  case 'kawaii': {
    resolved = 'low'
  
  break;
  }
  case 'default': 
  case 'regular': {
    resolved = 'default'
  
  break;
  }
  // No default
  }

  if (stored && stored !== resolved) {
    storage.setItem(COLOR_STYLE_STORAGE_KEY, resolved)
  }

  return resolved
}

const accentColorAtom = atom<AccentColorId>(loadAccentColor())
const colorStyleAtom = atom<AppColorStyle>(loadColorStyle())

const [, , useAccentColor, , getAccentColor, setAccentColorAtom] =
  createAtomHooks(accentColorAtom)

const [, , useColorStyle, , getColorStyle, setColorStyleAtom] =
  createAtomHooks(colorStyleAtom)

const setAccentColor = (id: AccentColorId) => {
  const preset =
    ACCENT_COLOR_PRESET_MAP[id] ?? ACCENT_COLOR_PRESET_MAP[DEFAULT_ACCENT_COLOR]
  setAccentColorAtom(preset.id)
  storage.setItem(ACCENT_STORAGE_KEY, preset.id)
}

const setColorStyle = (style: AppColorStyle) => {
  const next = style === 'low' || style === 'high' ? style : 'default'

  setColorStyleAtom(next)
  storage.setItem(COLOR_STYLE_STORAGE_KEY, next)
}

export const COLOR_STYLE_OPTIONS: {
  id: AppColorStyle
  labelKey: I18nKeysForSettings
  descriptionKey: I18nKeysForSettings
}[] = [
  {
    id: 'default',
    labelKey: 'general.appearance.colorStyle.options.regular',
    descriptionKey: 'general.appearance.colorStyle.descriptions.regular',
  },
  {
    id: 'low',
    labelKey: 'general.appearance.colorStyle.options.kawaii',
    descriptionKey: 'general.appearance.colorStyle.descriptions.kawaii',
  },
  {
    id: 'high',
    labelKey: 'general.appearance.colorStyle.options.highContrast',
    descriptionKey: 'general.appearance.colorStyle.descriptions.highContrast',
  },
]

export {
  getAccentColor,
  getColorStyle,
  setAccentColor,
  setColorStyle,
  useAccentColor,
  useColorStyle,
}
