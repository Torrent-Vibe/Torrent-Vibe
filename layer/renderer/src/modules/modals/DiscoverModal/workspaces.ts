import type { DiscoverProviderId } from '~/atoms/settings/discover'

import { mikanWorkspace } from './mikan/workspace'
import { mteamWorkspace } from './mteam/workspace'
import type { DiscoverWorkspace } from './workspace-types'

export type { DiscoverWorkspace } from './workspace-types'

export const discoverWorkspaces: Record<DiscoverProviderId, DiscoverWorkspace> =
  {
    mteam: mteamWorkspace,
    mikan: mikanWorkspace,
  }
