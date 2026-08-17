/* eslint-disable react-refresh/only-export-components */
import { redirect } from 'react-router'

import {
  discoverPath,
  resolveDiscoverProviderId,
} from '~/modules/modals/DiscoverModal/open'

export const loader = () => redirect(discoverPath(resolveDiscoverProviderId()))

export const Component = () => null
