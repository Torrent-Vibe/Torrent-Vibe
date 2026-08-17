/* eslint-disable react-refresh/only-export-components */
import { Outlet } from 'react-router'

import { DiscoverModal } from '~/modules/modals/DiscoverModal'

import { requireConnection } from '../require-connection'

export const loader = requireConnection

export const Component = () => {
  return (
    <DiscoverModal>
      <Outlet />
    </DiscoverModal>
  )
}
