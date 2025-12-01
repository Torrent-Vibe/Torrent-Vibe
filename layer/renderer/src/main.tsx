import './styles/index.css'

import { enableMapSet } from 'immer'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import {
  initializeDevTools,
  initializeDragAndDropGuards,
  initializeEnvironment,
  initializeI18nLanguage,
} from './initialize'
import { router } from './router'

enableMapSet()
initializeEnvironment()
initializeDragAndDropGuards()
await initializeI18nLanguage()

const $container = document.querySelector('#root') as HTMLElement

await initializeDevTools()
createRoot($container).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
