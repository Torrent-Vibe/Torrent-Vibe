import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { MainSupportedLanguages } from '~/@types/constants'
import { currentSupportedLanguages } from '~/@types/constants'
import { getI18n } from '~/i18n'
import { ipcServices } from '~/lib/ipc-client'
import { STORAGE_KEYS } from '~/lib/storage-keys'

export const useLanguage = () => {
  const { i18n } = useTranslation()

  const currentLanguage = i18n.language as MainSupportedLanguages

  const changeLanguage = useCallback(
    async (language: MainSupportedLanguages) => {
      try {
        await i18n.changeLanguage(language)
        localStorage.setItem(STORAGE_KEYS.PREFERRED_LANGUAGE, language)

        // Sync language to main process if in Electron
        if (window.ipcRenderer) {
          await ipcServices?.app.setMainLanguage(language)
        }
      } catch (error) {
        console.error('Failed to change language:', error)
      }
    },
    [i18n],
  )

  const getStoredLanguage = useCallback((): MainSupportedLanguages | null => {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_LANGUAGE)
    if (stored && currentSupportedLanguages.includes(stored)) {
      return stored as MainSupportedLanguages
    }
    return null
  }, [])

  const initializeLanguage = useCallback(async () => {
    const stored = getStoredLanguage()
    if (stored && stored !== currentLanguage) {
      await changeLanguage(stored)
    }
  }, [currentLanguage, changeLanguage, getStoredLanguage])

  return {
    currentLanguage,
    changeLanguage,
    getStoredLanguage,
    initializeLanguage,
    supportedLanguages: currentSupportedLanguages as MainSupportedLanguages[],
  }
}

// Initialize language on app start
export const initializeAppLanguage = async () => {
  const stored = localStorage.getItem(STORAGE_KEYS.PREFERRED_LANGUAGE)
  if (stored && currentSupportedLanguages.includes(stored)) {
    const i18n = getI18n()
    await i18n.changeLanguage(stored)

    // Sync initial language to main process if in Electron
    if (window.ipcRenderer) {
      ipcServices?.app.setMainLanguage(stored)
    }
  }
}
