/* eslint-disable react-refresh/only-export-components */
import { redirect, useParams } from 'react-router'

import type { DiscoverProviderId } from '~/atoms/settings/discover'
import {
  discoverPath,
  isDiscoverProviderId,
  resolveDiscoverProviderId,
} from '~/modules/modals/DiscoverModal/open'
import { discoverWorkspaces } from '~/modules/modals/DiscoverModal/workspaces'

export const loader = ({ params }: { params: { type?: string } }) => {
  if (!isDiscoverProviderId(params.type)) {
    return redirect(discoverPath(resolveDiscoverProviderId()))
  }
  return null
}

export const Component = () => {
  const { type } = useParams()
  if (!isDiscoverProviderId(type)) {
    return null
  }
  const Body = discoverWorkspaces[type as DiscoverProviderId].Body
  return <Body />
}
