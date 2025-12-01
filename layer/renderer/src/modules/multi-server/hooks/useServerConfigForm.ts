import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { getI18n } from '~/i18n'
import type { QBittorrentConfig } from '~/shared/types/qbittorrent'

import type { ServerFormData, TestResult } from '../components/ServerConfigForm'
import {
  multiServerStoreSetters,
  useMultiServerStore,
} from '../stores/multi-server-store'
import {
  createServerFromConfig,
  hasServerPassword,
  loadServerPassword,
  saveMultiServerConfig,
  saveServerPassword,
} from '../utils/server-config'

interface UseServerConfigFormOptions {
  mode: 'add' | 'edit'
  serverId?: string
  onSuccess?: (serverId: string, action: 'created' | 'updated') => void
  onError?: (error: Error) => void
}

export const useServerConfigForm = ({
  mode,
  serverId,
  onSuccess,
  onError,
}: UseServerConfigFormOptions) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const { servers, order } = useMultiServerStore((s) => ({
    servers: s.servers,
    order: s.order,
  }))

  // Get initial data for edit mode
  const getInitialData = useCallback(async (): Promise<
    Partial<ServerFormData> | undefined
  > => {
    if (mode !== 'edit' || !serverId) return undefined

    const server = servers[serverId]
    if (!server) return undefined

    const remembered = hasServerPassword(serverId)
    const savedPassword = remembered ? await loadServerPassword(serverId) : ''

    return {
      name: server.name,
      host: server.config.host,
      port: server.config.port.toString(),
      username: server.config.username,
      password: savedPassword || '',
      useHttps: server.config.useHttps,

      remember: remembered,
    }
  }, [mode, serverId, servers])

  const handleSubmit = async (formData: ServerFormData): Promise<void> => {
    setIsSubmitting(true)
    try {
      const config: QBittorrentConfig = {
        host: formData.host,
        port: Number(formData.port) || 0,
        username: formData.username,
        password: formData.password ?? '',
        useHttps: formData.useHttps,
      }

      if (mode === 'add') {
        const server = createServerFromConfig(
          formData.name || 'New Server',
          config,
          order.length === 0, // Set as default if it's the first server
        )

        multiServerStoreSetters.addServer(server)

        if (formData.remember && config.password !== '') {
          await saveServerPassword(server.id, config.password)
        }

        toast.success(getI18n().t('messages.serverAdded'))
        onSuccess?.(server.id, 'created')
      } else if (mode === 'edit' && serverId) {
        multiServerStoreSetters.updateServer(serverId, {
          name: formData.name,
          config,
        })

        if (formData.remember && config.password !== '') {
          await saveServerPassword(serverId, config.password)
        }

        toast.success(getI18n().t('messages.serverUpdated'))
        onSuccess?.(serverId, 'updated')
      }

      // Save the updated configuration
      saveMultiServerConfig({
        servers: Object.values(useMultiServerStore.getState().servers),
        activeServerId: useMultiServerStore.getState().activeServerId,
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      const key = mode === 'add' ? 'messages.serverAddFailed' : 'messages.serverUpdateFailed'
      toast.error(`${getI18n().t(key)}: ${err.message}`)
      onError?.(err)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTest = async (): Promise<TestResult> => {
    try {
      // Test logic is handled by the component itself
      // This hook just manages the test result state
      const result: TestResult = {
        success: true,
        message: 'Connection test completed',
      }
      setTestResult(result)
      return result
    } catch (error) {
      const result: TestResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      }
      setTestResult(result)
      return result
    }
  }

  const resetForm = () => {
    setTestResult(null)
    setIsSubmitting(false)
  }

  return {
    isSubmitting,
    testResult,
    getInitialData,
    handleSubmit,
    handleTest,
    resetForm,
  }
}
