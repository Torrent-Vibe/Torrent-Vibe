import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { AuthFailureAlert } from '~/components/common/AuthFailureAlert'
import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal/ModalManager'
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
import { AppSettingsImportModal } from '~/modules/settings-data-management'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import {
  getInitialQBittorrentConfig,
  loadStoredConnectionConfig,
  saveStoredConnectionConfig,
} from '~/shared/config'

import { OnboardingFields } from './OnboardingFields'
import type { OnboardingFormData } from './onboardingStorage'
import {
  clearFormDataFromStorage,
  loadFormDataFromStorage,
} from './onboardingStorage'

type ValidationState = 'idle' | 'validating' | 'success' | 'error'

const FORM_VALIDATION_KEYS = {
  hostMessage: 'onboarding.fields.host.required',
  portMessage: 'onboarding.fields.port.required',
  usernameMessage: 'onboarding.fields.username.required',
} as Record<string, I18nKeys>

const VALIDATION_STATES_KEYS = {
  idle: {
    buttonText: 'onboarding.buttons.saveAndContinue',
    disabled: false,
    showError: false,
  },
  validating: {
    buttonText: 'onboarding.buttons.validating',
    disabled: true,
    showError: false,
  },
  success: {
    buttonText: 'onboarding.buttons.connectionSuccessful',
    disabled: false,
    showError: false,
  },
  error: {
    buttonText: 'onboarding.buttons.retryConnection',
    disabled: false,
    showError: true,
  },
} as const

export const Onboarding = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const [validationState, setValidationState] =
    useState<ValidationState>('idle')
  const [validationError, setValidationError] =
    useState<ValidationError | null>(null)

  const FORM_VALIDATION = {
    hostMessage: t(FORM_VALIDATION_KEYS.hostMessage),
    portMin: 1,
    portMax: 65535,
    portMessage: t(FORM_VALIDATION_KEYS.portMessage),
    usernameMessage: t(FORM_VALIDATION_KEYS.usernameMessage),
  }

  const VALIDATION_STATES = {
    idle: {
      buttonText: t(VALIDATION_STATES_KEYS.idle.buttonText),
      disabled: false,
      showError: false,
    },
    validating: {
      buttonText: t(VALIDATION_STATES_KEYS.validating.buttonText),
      disabled: true,
      showError: false,
    },
    success: {
      buttonText: t(VALIDATION_STATES_KEYS.success.buttonText),
      disabled: false,
      showError: false,
    },
    error: {
      buttonText: t(VALIDATION_STATES_KEYS.error.buttonText),
      disabled: false,
      showError: true,
    },
  } as const

  const currentState = VALIDATION_STATES[validationState]

  const computeDefaultValues = useCallback((): OnboardingFormData => {
    const initial = getInitialQBittorrentConfig()
    const saved = loadStoredConnectionConfig().stored
    const localStorageData = loadFormDataFromStorage()

    const PARAM_MAPPINGS = {
      host: ['host'],
      port: ['port'],
      username: ['username', 'user', 'u'],
      password: ['password', 'pass', 'p'],
      useHttps: ['https', 'useHttps', 'secure', 'ssl', 'tls'],
      rememberPassword: ['remember', 'rememberPassword', 'remember_password'],
    } as const

    const parseBoolean = (
      value: string | null | undefined,
    ): boolean | undefined => {
      if (!value) return undefined
      const normalized = value.toLowerCase()
      return (
        normalized === '1' ||
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === 'on'
      )
    }

    const getParamValue = (keys: readonly string[]): string | null => {
      for (const key of keys) {
        const value = searchParams.get(key)
        if (value) return value
      }
      return null
    }

    const baseUrl = searchParams.get('baseUrl') || searchParams.get('url')
    let urlConfig: Partial<OnboardingFormData> = {}
    if (baseUrl) {
      try {
        const url = new URL(baseUrl)
        urlConfig = {
          host: url.hostname || undefined,
          port: url.port ? Number(url.port) : undefined,
          useHttps: url.protocol === 'https:',
        }
      } catch {
        // ignore invalid URL
      }
    }

    const paramValues = {
      host: getParamValue(PARAM_MAPPINGS.host),
      port: getParamValue(PARAM_MAPPINGS.port),
      username: getParamValue(PARAM_MAPPINGS.username),
      password: getParamValue(PARAM_MAPPINGS.password),
      useHttps:
        window.location.protocol === 'https:' ||
        parseBoolean(getParamValue(PARAM_MAPPINGS.useHttps)),
      rememberPassword: parseBoolean(
        getParamValue(PARAM_MAPPINGS.rememberPassword),
      ),
    }

    return {
      host:
        paramValues.host ||
        urlConfig.host ||
        (localStorageData.host as string | undefined) ||
        initial.host ||
        '',
      port:
        (paramValues.port && !Number.isNaN(Number(paramValues.port))
          ? Number(paramValues.port)
          : undefined) ||
        urlConfig.port ||
        (localStorageData.port as number | undefined) ||
        initial.port ||
        undefined,
      username:
        paramValues.username ||
        (localStorageData.username as string | undefined) ||
        initial.username ||
        '',
      password:
        paramValues.password ||
        (localStorageData.password as string | undefined) ||
        initial.password ||
        '',
      useHttps:
        window.location.protocol === 'https:' ||
        (paramValues.useHttps ??
          urlConfig.useHttps ??
          (localStorageData.useHttps as boolean | undefined) ??
          (typeof globalThis !== 'undefined' &&
            globalThis.location?.protocol === 'https:') ??
          true),
      rememberPassword:
        paramValues.rememberPassword ??
        (localStorageData.rememberPassword as boolean | undefined) ??
        saved?.rememberPassword ??
        false,
      useCurrentPath:
        (localStorageData.useCurrentPath as boolean | undefined) ?? true,
    }
  }, [searchParams])

  const defaultValues = useMemo<OnboardingFormData>(
    () => computeDefaultValues(),
    [computeDefaultValues],
  )

  const { control, handleSubmit, watch, getValues, reset } =
    useForm<OnboardingFormData>({
      defaultValues,
      mode: 'all',
    })

  useEffect(() => {
    reset(defaultValues)
  }, [defaultValues, reset])

  const useCurrentPath = watch('useCurrentPath')

  const validateConnectionData = async (data: OnboardingFormData) => {
    const config = createConnectionConfig({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      useHttps: data.useHttps,
      useCurrentPath: data.useCurrentPath,
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
          useCurrentPath: formData.useCurrentPath,
        })
        saveStoredConnectionConfig(config, formData.rememberPassword)
        QBittorrentClient.configure(config)
        await qbQueryManager.scenarios.onConnectionChange()
        jotaiStore.set(authStatusAtom, 'authenticated')
        jotaiStore.set(connectionStatusAtom, 'connected')
        jotaiStore.set(lastAuthErrorAtom, null)
        jotaiStore.set(lastConnectionErrorAtom, null)
        clearFormDataFromStorage()
        toast.success(t('onboarding.messages.connectionSuccessful'))
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
        message: t('onboarding.messages.unexpectedError'),
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

  const handleImportSettings = () => {
    Modal.present(AppSettingsImportModal, {
      onImported: () => {
        reset(computeDefaultValues())
        setValidationState('idle')
        setValidationError(null)
      },
    })
  }

  return (
    <div className="flex min-h-screen [*]:select-none items-center justify-center p-6 electron:bg-transparent bg-background/90">
      <div className="drag-region inset-x-0 top-0 h-10 fixed" />
      <form
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        className="w-full bg-background max-w-md space-y-5 rounded-xl border border-neutral-200 p-6 shadow-sm dark:border-neutral-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t('onboarding.title')}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {t('onboarding.description')}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleImportSettings}
          >
            {t('onboarding.actions.importSettings')}
          </Button>
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
                  {t('onboarding.messages.connectionFailed')}
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
                {t('onboarding.messages.connectionSuccessfulRedirecting')}
              </p>
            </div>
          </div>
        )}

        <OnboardingFields
          control={control}
          getValues={getValues}
          useCurrentPath={useCurrentPath}
          showUseCurrentPath
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
