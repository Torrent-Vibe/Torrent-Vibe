import { useCallback } from 'react'
import { toast } from 'sonner'

import { Modal } from '~/components/ui/modal'
import { InputPrompt } from '~/components/ui/prompts'
import { getI18n } from '~/i18n'
import { jotaiStore } from '~/lib/jotai'
import { qbQueryManager } from '~/lib/query/query-manager-instance'
import {
  authStatusAtom,
  connectionStatusAtom,
  lastAuthErrorAtom,
  lastConnectionErrorAtom,
} from '~/modules/connection/atoms/connection'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'

import {
  multiServerStoreSetters,
  useMultiServerStore,
} from '../stores/multi-server-store'
import { loadServerPassword, saveServerPassword } from '../utils/server-config'

export function useServerSwitching() {
  const activeId = useMultiServerStore((s) => s.activeServerId)
  const servers = useMultiServerStore((s) => s.servers)

  const switchTo = useCallback(
    async (serverId: string) => {
      if (serverId === activeId) return
      const server = servers[serverId]
      if (!server) return

      try {
        multiServerStoreSetters.setSwitching(serverId)
        jotaiStore.set(connectionStatusAtom, 'connecting')
        jotaiStore.set(lastConnectionErrorAtom, null)
        jotaiStore.set(lastAuthErrorAtom, null)

        // Configure shared client to new server (inject remembered password if present)
        const remembered = await loadServerPassword(server.id)

        if (!remembered && !server.config.password) {
          toast.error(getI18n().t('messages.noPasswordRemembered'))

          Modal.present(InputPrompt, {
            type: 'password',
            title: 'Enter password for the selected server',
            onConfirm: async (value: string) => {
              await saveServerPassword(server.id, value)
              switchTo(server.id)
            },
            onCancel: async () => {},
          })

          return
        }

        const cfg = {
          ...server.config,
          password: remembered ?? server.config.password,
        }
        QBittorrentClient.configure(cfg)

        // Clear all cached queries to avoid cross-server contamination
        await qbQueryManager.scenarios.onConnectionChange()

        // Attempt login if password exists
        let loginOk = true
        try {
          loginOk = await QBittorrentClient.shared.login()
        } catch {
          loginOk = false
        }

        if (!loginOk) {
          jotaiStore.set(authStatusAtom, 'auth_failed')
          jotaiStore.set(
            lastAuthErrorAtom,
            'Authentication failed for the selected server',
          )
          jotaiStore.set(connectionStatusAtom, 'error')
          toast.error(getI18n().t('messages.authFailed'))
        } else {
          jotaiStore.set(authStatusAtom, 'authenticated')
          jotaiStore.set(connectionStatusAtom, 'connected')
          multiServerStoreSetters.setActiveServer(serverId)
          toast.success(
            getI18n().t('messages.serverSwitched', { serverName: server.name }),
          )
        }
      } catch (error) {
        console.error(getI18n().t('messages.serverSwitchFailed'), error)
        jotaiStore.set(connectionStatusAtom, 'error')
        jotaiStore.set(
          lastConnectionErrorAtom,
          error instanceof Error ? error.message : 'Unknown error',
        )
        toast.error(getI18n().t('messages.serverSwitchFailed'))
      } finally {
        multiServerStoreSetters.setSwitching(null)
      }
    },
    [activeId, servers],
  )

  return { switchTo }
}
