import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { atom } from 'jotai'
import { initReactI18next } from 'react-i18next'

import { EventBus } from '~/lib/event-bus'
import { STORAGE_KEYS } from '~/lib/storage-keys'

import { resources } from './@types/resources'
import { jotaiStore } from './lib/jotai'

const i18n = i18next.createInstance()
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      default: ['en'],
    },
    defaultNS: 'app',
    resources,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEYS.PREFERRED_LANGUAGE,
      caches: ['localStorage'],
    },
  })

export const i18nAtom = atom(i18n)

export const getI18n = () => {
  return jotaiStore.get(i18nAtom)
}

if (import.meta.hot) {
  import.meta.hot.on(
    'i18n-update',
    async ({ file, content }: { file: string; content: string }) => {
      const resources = JSON.parse(content)
      const i18next = jotaiStore.get(i18nAtom)

      const nsName = file.match(/locales\/(.+?)\//)?.[1]

      if (!nsName) return
      const lang = file.split('/').pop()?.replace('.json', '')
      if (!lang) return
      i18next.addResourceBundle(lang, nsName, resources, true, true)

      console.info('reload', lang, nsName)
      await i18next.reloadResources(lang, nsName)

      import.meta.env.DEV && EventBus.dispatch('I18N_UPDATE', '')
    },
  )
}
