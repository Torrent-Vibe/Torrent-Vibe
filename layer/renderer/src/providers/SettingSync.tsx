import {
  useSyncAccentPreference,
  useSyncContrastPreference,
  useSyncTheme,
} from '~/hooks/common'

const useUISettingSync = () => {
  useSyncTheme()
  useSyncContrastPreference()
  useSyncAccentPreference()
}

export const SettingSync = () => {
  useUISettingSync()

  return null
}
