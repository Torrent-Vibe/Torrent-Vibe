import './styles/index.css'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'jotai'
import * as React from 'react'
import { createRoot } from 'react-dom/client'

import { Panel } from './apps/mini-panel'
import { AuthInitializer } from './components/common/AuthInitializer'

// Prevent default browser behavior of opening files when dropped onto the window.
// Do not stop propagation so app-level drop handlers still receive the events.
window.addEventListener('dragover', (event) => {
  event.preventDefault()
})
window.addEventListener('drop', (event) => {
  event.preventDefault()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 60_000,
    },
  },
})

const $container = document.querySelector('#root') as HTMLElement

createRoot($container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider>
        <AuthInitializer />
        <Panel />
      </Provider>
    </QueryClientProvider>
  </React.StrictMode>,
)
