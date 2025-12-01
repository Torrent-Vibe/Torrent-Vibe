import type { TFunction } from 'i18next'

import { ServersTab } from '~/modules/multi-server/components/ServersTab'

import { AboutTab } from './tabs/AboutTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { ApiTokensTab } from './tabs/ApiTokensTab'
import { AppConnectionTab } from './tabs/AppConnectionTab'
import { BitTorrentTab } from './tabs/BitTorrentTab'
import { ConnectionTab } from './tabs/ConnectionTab'
import { DiscoverTab } from './tabs/discover'
import { DownloadsTab } from './tabs/DownloadsTab'
import { GeneralTab } from './tabs/GeneralTab'
import { SpeedTab } from './tabs/SpeedTab'
import { WebUITab } from './tabs/WebUITab'

export type SettingsSection =
  | 'appearance'
  | 'apiTokens'
  | 'discover'
  | 'appConnection'
  | 'servers'
  | 'about'
  | 'downloads'
  | 'connection'
  | 'speed'
  | 'bittorrent'
  | 'webui'
  | 'advanced'

export type SidebarGroupId = 'app' | 'qbittorrent'

export interface SidebarGroup {
  id: SidebarGroupId
  translationKey: I18nKeysForSettings
  keys: SettingsSection[]
}

const BASE_SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: 'app',
    translationKey: 'sidebar.groups.appSettings',
    keys: [
      'appearance',
      'discover',
      'apiTokens',
      'appConnection',
      'servers',
      'about',
    ],
  },
  {
    id: 'qbittorrent',
    translationKey: 'sidebar.groups.qbittorrentSettings',
    keys: [
      'downloads',
      'connection',
      'speed',
      'bittorrent',
      'webui',
      'advanced',
    ],
  },
]

export const getTabConfig = (
  t: TFunction<'setting'>,
): Record<
  SettingsSection,
  { label: string; icon: string; description: string; Component: React.FC }
> => ({
  appearance: {
    label: t('tabs.general.label'),
    icon: 'i-mingcute-brush-3-line',
    description: t('tabs.general.description'),
    Component: GeneralTab,
  },
  apiTokens: {
    label: t('tabs.apiTokens.label'),
    icon: 'i-lucide-key-round',
    description: t('tabs.apiTokens.description'),
    Component: ApiTokensTab,
  },
  discover: {
    label: t('tabs.discover.label'),
    icon: 'i-mingcute-safari-line',
    description: t('tabs.discover.description'),
    Component: DiscoverTab,
  },
  appConnection: {
    label: t('tabs.appConnection.label'),
    icon: 'i-mingcute-link-2-line',
    description: t('tabs.appConnection.description'),
    Component: AppConnectionTab,
  },
  servers: {
    label: t('tabs.servers.label'),
    icon: 'i-mingcute-server-2-line',
    description: t('tabs.servers.description'),
    Component: ServersTab,
  },
  about: {
    label: t('tabs.about.label'),
    icon: 'i-mingcute-information-line',
    description: t('tabs.about.description'),
    Component: AboutTab,
  },
  downloads: {
    label: t('tabs.downloads.label'),
    icon: 'i-mingcute-download-2-line',
    description: t('tabs.downloads.description'),
    Component: DownloadsTab,
  },
  connection: {
    label: t('tabs.connection.label'),
    icon: 'i-mingcute-wifi-line',
    description: t('tabs.connection.description'),
    Component: ConnectionTab,
  },
  speed: {
    label: t('tabs.speed.label'),
    icon: 'i-mingcute-download-line',
    description: t('tabs.speed.description'),
    Component: SpeedTab,
  },
  bittorrent: {
    label: t('tabs.bittorrent.label'),
    icon: 'i-mingcute-star-2-line',
    description: t('tabs.bittorrent.description'),
    Component: BitTorrentTab,
  },
  webui: {
    label: t('tabs.webui.label'),
    icon: 'i-mingcute-globe-2-line',
    description: t('tabs.webui.description'),
    Component: WebUITab,
  },
  advanced: {
    label: t('tabs.advanced.label'),
    icon: 'i-mingcute-settings-6-line',
    description: t('tabs.advanced.description'),
    Component: AdvancedTab,
  },
})

export const SIDEBAR_GROUPS: SidebarGroup[] = (() => {
  return BASE_SIDEBAR_GROUPS.map((group) => {
    const filteredKeys = group.keys.filter((key) => {
      if (!ELECTRON && key === 'servers') {
        return false
      }

      if (!ELECTRON && key === 'apiTokens') {
        return false
      }

      if (ELECTRON && key === 'appConnection') {
        return false
      }

      return true
    })

    return {
      ...group,
      keys: filteredKeys as SettingsSection[],
    }
  }).filter((group) => group.keys.length > 0)
})()

export const SIDEBAR_KEYS = (() => {
  return SIDEBAR_GROUPS.flatMap((group) => group.keys)
})()
