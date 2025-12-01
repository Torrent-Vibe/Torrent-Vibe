import { createBrowserRouter } from 'react-router'

import { App } from './App'
import { routes } from './apps/main/generated-routes'
import { ErrorElement } from './components/common/ErrorElement'
import { NotFound } from './components/common/NotFound'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: routes,
    errorElement: <ErrorElement />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
