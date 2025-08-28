import { atom, useAtomValue } from 'jotai'
import { selectAtom } from 'jotai/utils'
import { useMemo } from 'react'

import { createAtomHooks } from '~/lib/jotai'

interface RouteAtom {
  pathname: string
  searchParams: URLSearchParams
  params: Record<string, string>
}

export const [routeAtom, , , , getReadonlyRoute, setRoute] = createAtomHooks(
  atom<RouteAtom>({
    pathname: '/',
    searchParams: new URLSearchParams(),
    params: {},
  }),
)

const noop: any[] = []
export const useReadonlyRouteSelector = <T>(
  selector: (route: RouteAtom) => T,
  deps: any[] = noop,
): T =>
  useAtomValue(
    useMemo(() => selectAtom(routeAtom, (route) => selector(route)), deps),
  )
