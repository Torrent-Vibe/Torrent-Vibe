declare module 'next-themes' {
  import type * as React from 'react'

  export type ColorMode = 'light' | 'dark' | 'system'

  export interface ThemeProviderProps {
    attribute?: 'class' | 'data-theme'
    defaultTheme?: ColorMode
    enableSystem?: boolean
    enableColorScheme?: boolean
    storageKey?: string
    themes?: string[]
    value?: Record<string, string>
    children?: React.ReactNode
  }

  export function ThemeProvider(props: ThemeProviderProps): JSX.Element

  export interface UseThemeReturn {
    theme?: ColorMode | string
    resolvedTheme?: 'light' | 'dark'
    systemTheme?: 'light' | 'dark'
    setTheme: (theme: ColorMode | string) => void
    themes: string[]
  }

  export function useTheme(): UseThemeReturn
}
