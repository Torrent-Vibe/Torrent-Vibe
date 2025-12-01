import { redirect } from 'react-router'

import { useMobile } from '~/hooks/common'
import { Layout as DesktopLayout } from '~/modules/layout/desktop/components/Layout'
import { Layout as MobileLayout } from '~/modules/layout/mobile/Layout'
import { checkHasPersistConnectionConfig } from '~/shared/config'

export const Component = () => {
  const isMobile = useMobile()
  return isMobile ? <MobileLayout /> : <DesktopLayout />
}

export const loader = () => {
  if (!checkHasPersistConnectionConfig()) {
    return redirect('/onboarding')
  }
  return {}
}
