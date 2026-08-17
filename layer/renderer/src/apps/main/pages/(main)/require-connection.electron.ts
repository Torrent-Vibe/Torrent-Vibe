import { redirect } from 'react-router'

import { checkHasPersistMultiServerConfig } from '~/shared/config'

export const requireConnection = () => {
  if (!checkHasPersistMultiServerConfig()) {
    return redirect('/onboarding')
  }
  return {}
}
