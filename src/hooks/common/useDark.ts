'use client'

import { useTheme } from 'next-themes'

export type ColorMode = 'light' | 'dark' | 'system'

export function useIsDark(): boolean {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark'
}

// Returns the active theme value for UI libraries (always 'light' | 'dark')
export function useThemeAtomValue(): 'light' | 'dark' {
  const { theme, resolvedTheme } = useTheme()
  return (theme === 'system' ? resolvedTheme : theme) === 'dark'
    ? 'dark'
    : 'light'
}

export function useSetTheme(): (colorMode: ColorMode) => void {
  const { setTheme } = useTheme()
  return (colorMode: ColorMode) => setTheme(colorMode)
}

// Kept for backward compatibility; next-themes manages syncing via Provider
export function useSyncThemeark(): void {
  // no-op
}
