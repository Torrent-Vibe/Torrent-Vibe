import { currentSupportedLanguages } from '../@types/constants'
import { getI18n } from '../i18n'
import { ipcServices } from '../lib/ipc-client'
import { STORAGE_KEYS } from '../lib/storage-keys'

export const initializeI18nLanguage = async () => {
  const storedLanguage = localStorage.getItem(STORAGE_KEYS.PREFERRED_LANGUAGE)
  if (storedLanguage && currentSupportedLanguages.includes(storedLanguage)) {
    const i18n = getI18n()
    await i18n.changeLanguage(storedLanguage)
    if (window.ipcRenderer) {
      ipcServices?.app.setMainLanguage(storedLanguage)
    }
  }
}
