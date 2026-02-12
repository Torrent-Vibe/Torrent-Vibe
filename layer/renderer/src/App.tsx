import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'

import { useDocumentTitleSpeed } from './hooks/use-document-title-speed'
import { ipcServices } from './lib/ipc-client'
import { RootProviders } from './providers/RootProviders'

export const App: FC = () => {
  return (
    <RootProviders>
      <AppLayer />
    </RootProviders>
  )
}

const AppLayer = () => {
  const [appIsReady, setAppIsReady] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Update document title with transfer speeds (web only)
  useDocumentTitleSpeed()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAppIsReady(true)
  }, [appIsReady, location.pathname, navigate])

  useEffect(() => {
    if (!appIsReady) return
    // Do not auto-show the main window when rendering the mini floating view
    if (location.pathname === '/mini') return
    ipcServices?.window.showMainWindow()
  }, [appIsReady, location.pathname])

  return appIsReady ? <Outlet /> : <AppSkeleton />
}

const AppSkeleton = () => {
  return null
}
export default App

if (__DEV__ && ELECTRON) {
  // @ts-ignore
  window.ipcServices = ipcServices
}
