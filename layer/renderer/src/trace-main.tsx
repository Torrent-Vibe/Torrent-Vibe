import './styles/index.css'

import { enableMapSet } from 'immer'
import { Provider } from 'jotai'
import { domMax, LazyMotion } from 'motion/react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { TorrentAiTraceApp } from './apps/ai-trace'
import { Toaster } from './components/ui/sonner'
import {
  initializeDragAndDropGuards,
  initializeEnvironment,
  initializeI18nLanguage,
} from './initialize'
import { jotaiStore } from './lib/jotai'
import { I18nProvider } from './providers/i18Provider'
import { SettingSync } from './providers/SettingSync'

enableMapSet()
initializeEnvironment()
initializeDragAndDropGuards()

const $container = document.querySelector('#root') as HTMLElement

void initializeI18nLanguage().then(() => {
  createRoot($container).render(
    <React.StrictMode>
      <LazyMotion strict features={domMax}>
        <Provider store={jotaiStore}>
          <I18nProvider>
            <SettingSync />
            <TorrentAiTraceApp />
            <Toaster />
          </I18nProvider>
        </Provider>
      </LazyMotion>
    </React.StrictMode>,
  )
})
