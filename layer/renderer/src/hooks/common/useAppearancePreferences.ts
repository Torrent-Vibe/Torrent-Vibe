import { useEffect } from 'react'

import {
  ACCENT_COLOR_PRESET_MAP,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_COLOR_STYLE,
  useAccentColor,
  useColorStyle,
} from '~/atoms/settings/appearance'

import { useIsDark } from './useDark'

export const useSyncAccentPreference = () => {
  const accent = useAccentColor()
  const isDark = useIsDark()

  useEffect(() => {
    const root = document.documentElement
    const preset =
      ACCENT_COLOR_PRESET_MAP[accent || DEFAULT_ACCENT_COLOR] ||
      ACCENT_COLOR_PRESET_MAP[DEFAULT_ACCENT_COLOR]

    const accentColor = isDark ? preset.darkColor : preset.lightColor

    root.dataset.accent = preset.id

    const $style = document.createElement('style')
    document.documentElement.dataset.themeOverride = 'true'
    $style.textContent = `
      html[data-theme-override='true'] #root *,
      html[data-theme-override='true'] #main-app * {
        --color-accent: ${accentColor};
        --color-accent-light: ${preset.lightColor};
        --color-accent-dark: ${preset.darkColor};
      }
    `
    root.append($style)

    return () => {
      $style.remove()
    }
  }, [accent, isDark])
}

export const useSyncContrastPreference = () => {
  const colorStyle = useColorStyle()

  useEffect(() => {
    const root = document.documentElement
    const style = colorStyle || DEFAULT_COLOR_STYLE

    root.dataset.contrast = style
  }, [colorStyle])
}
