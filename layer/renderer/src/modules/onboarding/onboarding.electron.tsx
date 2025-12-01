import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AuthFailureAlert } from '~/components/common/AuthFailureAlert'
import { Button } from '~/components/ui/button'
import { getI18n } from '~/i18n'
import { jotaiStore } from '~/lib/jotai'
import { qbQueryManager } from '~/lib/query/query-manager-instance'
import {
  authStatusAtom,
  connectionStatusAtom,
  lastAuthErrorAtom,
  lastConnectionErrorAtom,
} from '~/modules/connection/atoms/connection'
import type { ValidationError } from '~/modules/connection/validation'
import {
  createConnectionConfig,
  validateConnection,
} from '~/modules/connection/validation'
import {
  multiServerStoreSetters,
  useMultiServerStore,
} from '~/modules/multi-server/stores/multi-server-store'
import {
  createServerFromConfig,
  hasServerPassword,
  loadServerPassword,
  saveMultiServerConfig,
  saveServerPassword,
} from '~/modules/multi-server/utils/server-config'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import { getInitialQBittorrentConfig } from '~/shared/config'

import { OnboardingFields } from './OnboardingFields'
import type { OnboardingFormData } from './onboardingStorage'
import {
  clearFormDataFromStorage,
  loadFormDataFromStorage,
} from './onboardingStorage'

type ValidationState = 'idle' | 'validating' | 'success' | 'error'

const FORM_VALIDATION = {
  hostMessage: 'Host is required',
  portMin: 1,
  portMax: 65535,
  portMessage: 'Port must be between 1 and 65535',
  usernameMessage: 'Username is required',
}

const VALIDATION_STATES = {
  idle: { buttonText: 'Save and continue', disabled: false, showError: false },
  validating: {
    buttonText: 'Validating connection...',
    disabled: true,
    showError: false,
  },
  success: {
    buttonText: 'Connection successful!',
    disabled: false,
    showError: false,
  },
  error: { buttonText: 'Retry connection', disabled: false, showError: true },
} as const

export const Onboarding = () => {
  const navigate = useNavigate()
  const [validationState, setValidationState] =
    useState<ValidationState>('idle')
  const [validationError, setValidationError] =
    useState<ValidationError | null>(null)
  const currentState = VALIDATION_STATES[validationState]

  const { servers, activeServerId, order } = useMultiServerStore((s) => ({
    servers: s.servers,
    activeServerId: s.activeServerId,
    order: s.order,
  }))

  const active = activeServerId ? servers[activeServerId] : undefined

  const defaultValues = useMemo<OnboardingFormData>(() => {
    const local = loadFormDataFromStorage()
    const initial = getInitialQBittorrentConfig()
    const base = active || (order.length > 0 ? servers[order[0]] : undefined)

    return {
      host: local.host ?? base?.config.host ?? initial.host ?? '',
      port: local.port ?? base?.config.port ?? initial.port ?? undefined,
      username:
        local.username ?? base?.config.username ?? initial.username ?? '',
      password: local.password ?? '',
      useHttps:
        local.useHttps ?? base?.config.useHttps ?? initial.useHttps ?? true,
      rememberPassword:
        local.rememberPassword ??
        (active ? hasServerPassword(active.id) : false) ??
        false,
    }
  }, [active, order.length, servers])

  const { control, handleSubmit, getValues, reset, setValue, watch } =
    useForm<OnboardingFormData>({
      defaultValues,
      mode: 'all',
    })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  // Load saved password for active server if remembered
  useEffect(() => {
    const load = async () => {
      if (active && hasServerPassword(active.id)) {
        const pw = await loadServerPassword(active.id)
        if (pw) setValue('password', pw)
      }
    }
    load().catch(() => {})
  }, [active, setValue])

  const validateConnectionData = async (data: OnboardingFormData) => {
    const config = createConnectionConfig({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      useHttps: data.useHttps,
    })
    return await validateConnection(config)
  }

  const onSubmit = async (formData: OnboardingFormData) => {
    if (validationState === 'validating') return
    setValidationState('validating')
    setValidationError(null)
    try {
      const result = await validateConnectionData(formData)
      if (result.success) {
        setValidationState('success')
        const config = createConnectionConfig({
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          useHttps: formData.useHttps,
        })

        if (!active && order.length === 0) {
          const server = createServerFromConfig('Primary Server', config, true)
          multiServerStoreSetters.addServer(server)
          multiServerStoreSetters.setActiveServer(server.id)
          if (formData.rememberPassword && config.password) {
            await saveServerPassword(server.id, config.password)
          }
        } else if (active) {
          // Update active server config
          multiServerStoreSetters.updateServer(active.id, {
            config,
          })
          if (formData.rememberPassword && config.password) {
            await saveServerPassword(active.id, config.password)
          }
        }

        // Persist multi-server configuration
        saveMultiServerConfig({
          servers: Object.values(useMultiServerStore.getState().servers),
          activeServerId: useMultiServerStore.getState().activeServerId,
        })

        QBittorrentClient.configure(config)
        await qbQueryManager.scenarios.onConnectionChange()
        jotaiStore.set(authStatusAtom, 'authenticated')
        jotaiStore.set(connectionStatusAtom, 'connected')
        jotaiStore.set(lastAuthErrorAtom, null)
        jotaiStore.set(lastConnectionErrorAtom, null)
        clearFormDataFromStorage()
        toast.success(getI18n().t('onboarding.messages.connectionSuccessful'))
        navigate('/')
      } else {
        setValidationState('error')
        setValidationError(result.error!)
        toast.error(result.error!.message)
      }
    } catch {
      setValidationState('error')
      const fallbackError: ValidationError = {
        type: 'unknown',
        message: 'An unexpected error occurred',
      }
      setValidationError(fallbackError)
      toast.error(fallbackError.message)
    }
  }

  const onInvalid = (errs: any) => {
    const first = Object.values(errs)[0] as { message?: string } | undefined
    if (first?.message) toast.error(first.message)
  }

  const handleRetry = () => {
    setValidationState('idle')
    setValidationError(null)
  }

  const useCurrentPath = watch('useCurrentPath')

  return (
    <div className="flex min-h-screen [*]:select-none items-center justify-center p-6 electron:bg-transparent bg-background/90">
      <div className="drag-region inset-x-0 top-0 h-10 fixed" />
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="w-full bg-background max-w-md space-y-5 rounded-xl border border-neutral-200 p-6 shadow-sm dark:border-neutral-800"
      >
        <div>
          <h1 className="text-2xl font-semibold">
            Connect to qBittorrent Server
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter your WebUI connection details.
          </p>
        </div>
        <AuthFailureAlert />
        {currentState.showError && validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <div className="flex items-start gap-2">
              <div className="text-red-600 dark:text-red-400">
                <i className="i-mingcute-warning-line text-lg" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Connection Failed
                </h3>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {validationError.message}
                </p>
              </div>
            </div>
          </div>
        )}
        {validationState === 'success' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <div className="text-green-600 dark:text-green-400">
                <i className="i-mingcute-check-circle-fill text-lg" />
              </div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Connection successful! Redirecting...
              </p>
            </div>
          </div>
        )}

        <OnboardingFields
          control={control}
          getValues={getValues}
          useCurrentPath={useCurrentPath}
          showUseCurrentPath={false}
          validation={FORM_VALIDATION}
        />

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={currentState.disabled}
            className="flex-1"
          >
            {validationState === 'validating' && (
              <i className="i-mingcute-loading-3-line mr-2 animate-spin text-sm" />
            )}
            {currentState.buttonText}
          </Button>
          {validationState === 'error' && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleRetry}
              className="px-3"
            >
              <i className="i-mingcute-refresh-2-line text-sm" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
