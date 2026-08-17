import { redirect } from 'react-router'

import { checkHasPersistConnectionConfig } from '~/shared/config'

export const requireConnection = () => {
  if (!checkHasPersistConnectionConfig()) {
    return redirect('/onboarding')
  }
  return {}
}
