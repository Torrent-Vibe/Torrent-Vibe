import { createHashRouter } from 'react-router'

import { App } from './App'
// @ts-ignore
import { routes as tree } from './apps/main/generated-routes'
import { ErrorElement } from './components/common/ErrorElement'
import { NotFound } from './components/common/NotFound'

export const router = createHashRouter([
  {
    path: '/',
    Component: App,
    children: tree,
    errorElement: <ErrorElement />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])
