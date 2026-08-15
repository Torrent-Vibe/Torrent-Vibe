import type { AiProviderId, SearchProviderId } from '@torrent-vibe/shared'
import {
  AI_PROVIDER_IDS,
  API_TOKENS,
  DEFAULT_AI_PROVIDER_ORDER,
  DEFAULT_SEARCH_PROVIDER,
  SEARCH_PROVIDER_IDS,
} from '@torrent-vibe/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { ComboboxSelect } from '~/components/ui/select'
import {
  getAiIntegrationEnabled,
  setAiIntegrationEnabled,
} from '~/lib/ai-integration'
import { ipcServices } from '~/lib/ipc-client'
import type {
  ApiTokenSlotDefinition,
  ApiTokenSlotId,
  ApiTokenSlotState,
} from '~/modules/api-tokens'
import {
  AI_PROVIDER_DEFINITIONS,
  API_TOKEN_GROUPS,
  ApiTokenActions,
  useApiTokenStore,
} from '~/modules/api-tokens'
import { aiModelManager } from '~/modules/api-tokens/ai-model-manager'

import { ProviderSelect } from './api-tokens/ProviderSelect'
import { SettingField, SettingSectionCard } from './components'

const STATUS_KEY_MAP: Record<string, I18nKeysForSettings> = {
  loadFailed: 'tabs.apiTokens.status.loadFailed',
  notSupported: 'tabs.apiTokens.status.notSupported',
  saveFailed: 'tabs.apiTokens.status.saveFailed',
  clearFailed: 'tabs.apiTokens.status.clearFailed',
}

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  // Use custom formatting for Chinese to avoid mixed locale artifacts like 9/19/25, 12:03 AM

  const pad = (n: number) => n.toString().padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  return `${y}-${m}-${d} ${hh}:${mm}`
}

const buildStatusLabel = (
  t: ReturnType<typeof useTranslation<'setting'>>[0],
  slot: ApiTokenSlotState | undefined,
): string => {
  if (!slot) {
    return t('tabs.apiTokens.status.neverConfigured')
  }

  if (slot.isSaving) {
    return t('tabs.apiTokens.status.saving')
  }

  if (slot.error) {
    const mapped = STATUS_KEY_MAP[slot.error]
    if (mapped) {
      return t(mapped)
    }
    return slot.error
  }

  if (!slot.hasValue) {
    return t('tabs.apiTokens.status.neverConfigured')
  }

  const timeLabel = formatTimestamp(slot.updatedAt)
  if (slot.hint) {
    return t('tabs.apiTokens.status.configuredWithHint', {
      hint: slot.hint,
      time: timeLabel,
    })
  }

  return t('tabs.apiTokens.status.configured', {
    time: timeLabel,
  })
}

interface TokenSlotFieldProps {
  definition: ApiTokenSlotDefinition
  slot: ApiTokenSlotState | undefined
  disabled: boolean
}

const TokenSlotField = ({
  definition,
  slot,
  disabled,
}: TokenSlotFieldProps) => {
  const { t } = useTranslation('setting')
  const [draft, setDraft] = useState('')
  const [pendingAction, setPendingAction] = useState<'save' | 'clear' | null>(
    null,
  )

  // Model options fetching state (for OpenAI/OpenRouter model slots)
  const [modelOptions, setModelOptions] = useState<string[] | null>(null)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)

  // Observe related credential slots to know when to refetch models
  const relatedCredentialUpdatedAt = useApiTokenStore((state) => {
    if (definition.field !== 'model') {
      return null
    }
    if (definition.providerId === 'openai') {
      const apiKeySlot = state.slots[API_TOKENS.ai.openai.apiKey]
      const baseUrlSlot = state.slots[API_TOKENS.ai.openai.baseUrl]
      return `${apiKeySlot?.updatedAt ?? ''}|${baseUrlSlot?.updatedAt ?? ''}`
    }
    if (definition.providerId === 'openrouter') {
      const apiKeySlot = state.slots[API_TOKENS.ai.openrouter.apiKey]
      return `${apiKeySlot?.updatedAt ?? ''}`
    }
    if (definition.providerId === 'codex') {
      return 'codex'
    }
    return null
  })

  useEffect(() => {
    if (!slot) {
      return
    }
    if (slot.isSaving) {
      return
    }
    if (!pendingAction) {
      return
    }

    if (!slot.error && pendingAction === 'save') {
      setDraft('')
    }
    setPendingAction(null)
  }, [slot, pendingAction])

  useEffect(() => {
    if (!slot?.hasValue) {
      return
    }
    if (slot.isSaving) {
      return
    }
    if (definition.inputType === 'password') {
      return
    }
    if (draft.trim().length > 0) {
      return
    }

    let cancelled = false

    ;(async () => {
      const value = await ApiTokenActions.shared.getTokenValue(definition.id)
      if (!cancelled && typeof value === 'string') {
        setDraft(value)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    definition.id,
    definition.inputType,
    slot?.hasValue,
    slot?.isSaving,
    slot?.updatedAt,
    draft,
  ])
  // Fetch available models via manager (supports cancellation)
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    if (definition.field !== 'model') {
      return
    }

    const fetchModels = async () => {
      setIsLoadingModels(true)
      setModelsError(null)
      try {
        const provider = definition.providerId as AiProviderId
        const ids = await aiModelManager.getModels(provider, {
          signal: controller.signal,
        })
        if (!cancelled) {
          setModelOptions(ids)
        }
      }
      catch (error: any) {
        if (!cancelled) {
          setModelsError(error?.message || 'fetchFailed')
        }
        if (!cancelled) {
          setModelOptions([])
        }
      }
      finally {
        if (!cancelled) {
          setIsLoadingModels(false)
        }
      }
    }

    void fetchModels()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [definition.field, definition.providerId, relatedCredentialUpdatedAt])
  const onSave = async (value?: string) => {
    const submittedValue = value ?? draft
    if (!submittedValue.trim()) {
      return
    }
    setPendingAction('save')

    const result = await ApiTokenActions.shared.setTokenValue(
      definition.id,
      submittedValue,
    )
    if (!result.ok) {
      setPendingAction(null)
      toast.error(
        t('tabs.apiTokens.toast.saveFailed', {
          field: t(definition.labelKey),
        }),
      )
    }
  }

  const onClear = async () => {
    setPendingAction('clear')
    const result = await ApiTokenActions.shared.clearTokenValue(definition.id)
    if (!result.ok) {
      setPendingAction(null)
      setDraft('')
    }
  }

  const saving = Boolean(slot?.isSaving || pendingAction)
  const statusLabel = buildStatusLabel(t, slot)

  return (
    <SettingField
      label={t(definition.labelKey)}
      description={(
        <p className="flex flex-wrap gap-1">
          {t(definition.descriptionKey)}
          {definition.docsUrl
            ? (
                <a
                  href={definition.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  {t('tabs.apiTokens.learnMore')}
                </a>
              )
            : null}
        </p>
      )}
      controlClassName="flex flex-col gap-2"
    >
      <div className="flex w-full flex-col gap-2">
        {definition.field === 'model'
          ? (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ComboboxSelect
                    value={draft}
                    onValueChange={(v) => {
                      setDraft(v)
                      onSave(v)
                    }}
                    options={modelOptions ?? []}
                    placeholder={
                      definition.placeholderKey
                        ? t(definition.placeholderKey)
                        : undefined
                    }
                    allowCustom={true}
                    disabled={saving || disabled || isLoadingModels}
                    size="sm"
                    className="w-full"
                  />
                </div>
              </div>
            )
          : (
              <Input
                type={definition.inputType ?? 'password'}
                className="w-full"
                endAdornmentVisibility="always"
                value={draft}
                placeholder={
                  definition.placeholderKey
                    ? t(definition.placeholderKey)
                    : undefined
                }
                onChange={(event) => {
                  setDraft(event.target.value)
                }}
                disabled={saving || disabled}
                endAdornment={(
                  <div className="flex items-center gap-1 pr-1">
                    <Button
                      size="sm"
                      aria-label="Save"
                      type="button"
                      onClick={() => onSave()}
                      disabled={disabled || saving}
                      className="h-7 w-7 p-1.5 !bg-transparent"
                      variant="ghost"
                    >
                      <i className="i-mingcute-check-line text-base" />
                    </Button>

                    <Button
                      size="sm"
                      type="button"
                      aria-label="Clear"
                      variant="ghost"
                      className="h-7 w-7 p-1.5 !bg-transparent"
                      onClick={onClear}
                      disabled={disabled || saving}
                    >
                      <i className="i-mingcute-close-line text-base" />
                    </Button>
                  </div>
                )}
              />
            )}
      </div>
      <div className="text-[10px] h-4 text-text-tertiary">
        {saving
          ? (
              <span className="inline-flex items-center gap-1">
                <i className="i-mingcute-loading-3-line animate-spin" />
                {t('tabs.apiTokens.status.saving')}
              </span>
            )
          : isLoadingModels && definition.field === 'model'
            ? (
                <span className="inline-flex items-center gap-1">
                  <i className="i-mingcute-loading-3-line animate-spin" />
                </span>
              )
            : modelsError && definition.field === 'model'
              ? (
                  <span className="inline-flex items-center gap-1 text-red">
                    <i className="i-mingcute-alert-line" />
                    {modelsError}
                  </span>
                )
              : slot?.error
                ? (
                    STATUS_KEY_MAP[slot.error]
                      ? (
                          t(STATUS_KEY_MAP[slot.error])
                        )
                      : (
                          slot.error
                        )
                  )
                : slot?.hasValue
                  ? (
                      statusLabel
                    )
                  : (
                      <i className="i-mingcute-info-line" aria-hidden="true" />
                    )}
      </div>
    </SettingField>
  )
}

export const ApiTokensTab = () => {
  const { t } = useTranslation('setting')
  const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON
  const [aiEnabled, setAiEnabled] = useState<boolean>(() =>
    getAiIntegrationEnabled())
  const { initialized, isLoading, loadError, slots } = useApiTokenStore(
    state => ({
      initialized: state.initialized,
      isLoading: state.isLoading,
      loadError: state.loadError,
      slots: state.slots,
    }),
  )
  const [preferenceOrder, setPreferenceOrder] = useState<AiProviderId[]>(() => [
    ...DEFAULT_AI_PROVIDER_ORDER,
  ])
  const [preferredProvider, setPreferredProvider]
    = useState<AiProviderId | null>(null)
  const [preferenceInitialized, setPreferenceInitialized] = useState(false)
  const [preferenceLoading, setPreferenceLoading] = useState(false)
  const [preferenceSaving, setPreferenceSaving] = useState(false)
  const [searchProvider, setSearchProvider] = useState<SearchProviderId>(
    DEFAULT_SEARCH_PROVIDER,
  )
  const [searchSaving, setSearchSaving] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState<AiProviderId | null>(
    null,
  )

  const normalizePreferenceOrder = useCallback(
    (order?: unknown): AiProviderId[] => {
      if (!Array.isArray(order)) {
        return [...DEFAULT_AI_PROVIDER_ORDER]
      }

      const seen = new Set<AiProviderId>()
      const normalized: AiProviderId[] = []

      for (const value of order) {
        if (typeof value !== 'string') {
          continue
        }
        if (!AI_PROVIDER_IDS.includes(value as AiProviderId)) {
          continue
        }
        const id = value as AiProviderId
        if (seen.has(id)) {
          continue
        }
        seen.add(id)
        normalized.push(id)
      }

      if (normalized.length === 0) {
        return [...DEFAULT_AI_PROVIDER_ORDER]
      }

      for (const fallback of DEFAULT_AI_PROVIDER_ORDER) {
        if (!seen.has(fallback)) {
          normalized.push(fallback)
        }
      }

      return normalized
    },
    [],
  )

  useEffect(() => {
    if (!isElectron) {
      return
    }
    if (initialized) {
      return
    }
    void ApiTokenActions.shared.bootstrap()
  }, [initialized, isElectron])

  useEffect(() => {
    if (!isElectron) {
      return
    }
    let cancelled = false

    const loadPreference = async () => {
      setPreferenceLoading(true)
      try {
        const response = await ipcServices?.appSettings.getAiSettings?.()
        if (cancelled) {
          return
        }
        const order = normalizePreferenceOrder(response?.preferredProviders)
        setPreferenceOrder(order)
        setPreferredProvider(order[0] ?? null)
        setExpandedProvider(order[0] ?? null)
        const nextSearch
          = typeof response?.searchProvider === 'string'
            && SEARCH_PROVIDER_IDS.includes(
              response.searchProvider as SearchProviderId,
            )
            ? (response.searchProvider as SearchProviderId)
            : DEFAULT_SEARCH_PROVIDER
        setSearchProvider(nextSearch)
        setPreferenceInitialized(true)
      }
      catch (error) {
        if (cancelled) {
          return
        }
        console.error(
          '[api-tokens] failed to load AI provider preference',
          error,
        )
        const fallback = normalizePreferenceOrder()
        setPreferenceOrder(fallback)
        setPreferredProvider(fallback[0] ?? null)
        setExpandedProvider(fallback[0] ?? null)
        setSearchProvider(DEFAULT_SEARCH_PROVIDER)
        setPreferenceInitialized(true)
      }
      finally {
        if (!cancelled) {
          setPreferenceLoading(false)
        }
      }
    }

    void loadPreference()

    return () => {
      cancelled = true
    }
  }, [isElectron, normalizePreferenceOrder])

  const groupedSlots = useMemo(() => {
    return API_TOKEN_GROUPS.map(group => ({
      definition: group,
      slots: group.slots.map(slot => ({
        definition: slot,
        state: slots[slot.id as ApiTokenSlotId],
      })),
    }))
  }, [slots])

  const aiProviderViews = useMemo(() => {
    return AI_PROVIDER_DEFINITIONS.map((definition) => {
      const providerSlots = definition.slots.map(slot => ({
        definition: slot,
        state: slots[slot.id as ApiTokenSlotId],
      }))
      const configured = definition.requiredSlotIds.every((slotId) => {
        const state = slots[slotId as ApiTokenSlotId]
        return Boolean(state?.hasValue)
      })
      return { definition, slots: providerSlots, configured }
    })
  }, [slots])

  const configuredProviderIds = useMemo(
    () =>
      aiProviderViews
        .filter(provider => provider.configured)
        .map(provider => provider.definition.id),
    [aiProviderViews],
  )

  useEffect(() => {
    if (!preferenceInitialized) {
      return
    }
    if (configuredProviderIds.length === 0) {
      setPreferredProvider(null)
      return
    }

    setPreferredProvider((current) => {
      if (current && configuredProviderIds.includes(current)) {
        return current
      }
      const fallback
        = preferenceOrder.find(id => configuredProviderIds.includes(id))
          ?? configuredProviderIds[0]!
      return fallback
    })
  }, [configuredProviderIds, preferenceOrder, preferenceInitialized])

  const buildPreferenceOrder = useCallback(
    (primary: AiProviderId): AiProviderId[] => {
      const order: AiProviderId[] = []
      const seen = new Set<AiProviderId>()

      const add = (id: AiProviderId) => {
        if (seen.has(id)) {
          return
        }
        seen.add(id)
        order.push(id)
      }

      add(primary)
      for (const id of preferenceOrder) {
        add(id)
      }
      for (const fallback of DEFAULT_AI_PROVIDER_ORDER) {
        add(fallback)
      }

      return order
    },
    [preferenceOrder],
  )

  const handlePreferredProviderChange = useCallback(
    async (next: AiProviderId) => {
      setPreferredProvider(next)

      if (!isElectron) {
        setPreferenceOrder(buildPreferenceOrder(next))
        return
      }

      const service = ipcServices?.appSettings
      if (!service?.setAiPreferredProviders) {
        setPreferenceOrder(buildPreferenceOrder(next))
        return
      }

      const nextOrder = buildPreferenceOrder(next)
      setPreferenceSaving(true)

      try {
        const response = await service.setAiPreferredProviders({
          preferredProviders: nextOrder,
        })
        const resolvedOrder = normalizePreferenceOrder(
          response?.preferredProviders,
        )
        setPreferenceOrder(resolvedOrder)
        setPreferredProvider(resolvedOrder[0] ?? next)
        setExpandedProvider(next)
      }
      catch (error) {
        console.error(
          '[api-tokens] failed to update AI provider preference',
          error,
        )
        toast.error(t('tabs.apiTokens.providers.preference.saveFailed'))
        setPreferenceOrder(nextOrder)
      }
      finally {
        setPreferenceSaving(false)
      }
    },
    [buildPreferenceOrder, isElectron, normalizePreferenceOrder, t],
  )

  const chatProviderOptions = useMemo(
    () =>
      aiProviderViews.map(provider => ({
        id: provider.definition.id,
        label: t(provider.definition.labelKey),
      })),
    [aiProviderViews, t],
  )

  const searchProviderOptions = useMemo(
    () =>
      SEARCH_PROVIDER_IDS.map(id => ({
        id,
        label: t(`tabs.apiTokens.providers.${id}.label`),
      })),
    [t],
  )

  const handleSearchProviderChange = useCallback(
    async (next: SearchProviderId) => {
      setSearchProvider(next)
      if (!isElectron) {
        return
      }
      const service = ipcServices?.appSettings
      if (!service?.setAiSearchProvider) {
        return
      }
      setSearchSaving(true)
      try {
        const response = await service.setAiSearchProvider({
          searchProvider: next,
        })
        if (
          response?.searchProvider
          && SEARCH_PROVIDER_IDS.includes(response.searchProvider)
        ) {
          setSearchProvider(response.searchProvider)
        }
      }
      catch (error) {
        console.error('[api-tokens] failed to update AI search provider', error)
        toast.error(t('tabs.apiTokens.providers.search.saveFailed'))
      }
      finally {
        setSearchSaving(false)
      }
    },
    [isElectron, t],
  )

  if (!isElectron) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-text-secondary">
        {t('tabs.apiTokens.status.notSupported')}
      </div>
    )
  }

  const disableProviderFields = !aiEnabled || isLoading

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="rounded-md border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
          {(() => {
            const key = STATUS_KEY_MAP[loadError]
            return key ? t(key) : loadError
          })()}
        </div>
      )}

      {groupedSlots.map(({ definition, slots: groupSlots }) => (
        <SettingSectionCard
          key={definition.id}
          title={t(definition.labelKey)}
          description={t(definition.descriptionKey)}
          {...(definition.id === 'ai'
            ? {
                enabled: aiEnabled,
                onToggleEnabled: (enabled: boolean) => {
                  setAiEnabled(enabled)
                  setAiIntegrationEnabled(enabled)
                },
              }
            : {})}
        >
          {definition.id === 'ai'
            ? (
                <div className="space-y-4">
                  <ProviderSelect
                    label={t('tabs.apiTokens.providers.chat.label')}
                    description={t('tabs.apiTokens.providers.chat.description')}
                    placeholder={t(
                      'tabs.apiTokens.providers.preference.placeholder',
                    )}
                    options={chatProviderOptions}
                    value={preferredProvider}
                    onChange={handlePreferredProviderChange}
                    disabled={disableProviderFields || preferenceLoading}
                    loading={preferenceSaving || preferenceLoading}
                  />
                  <ProviderSelect
                    label={t('tabs.apiTokens.providers.search.label')}
                    description={t('tabs.apiTokens.providers.search.description')}
                    placeholder={t('tabs.apiTokens.providers.search.placeholder')}
                    options={searchProviderOptions}
                    value={searchProvider}
                    onChange={handleSearchProviderChange}
                    disabled={disableProviderFields || preferenceLoading}
                    loading={searchSaving || preferenceLoading}
                  />
                  <div className="space-y-2">
                    {aiProviderViews.map((provider) => {
                      const isOpen = expandedProvider === provider.definition.id
                      return (
                        <div
                          key={provider.definition.id}
                          className="overflow-hidden rounded-lg border border-border/60"
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-fill/40"
                            onClick={() =>
                              setExpandedProvider(
                                isOpen ? null : provider.definition.id,
                              )}
                          >
                            <i
                              className={`i-mingcute-down-line size-4 shrink-0 text-text-tertiary transition-transform ${
                                isOpen ? 'rotate-0' : '-rotate-90'
                              }`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {t(provider.definition.labelKey)}
                              </span>
                              {provider.definition.descriptionKey
                                ? (
                                    <span className="mt-0.5 block text-xs text-text-tertiary">
                                      {t(provider.definition.descriptionKey)}
                                    </span>
                                  )
                                : null}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                                provider.configured
                                  ? 'bg-green/10 text-green'
                                  : 'bg-fill/50 text-text-tertiary'
                              }`}
                            >
                              {provider.configured
                                ? t('tabs.apiTokens.providers.status.configured')
                                : t(
                                    'tabs.apiTokens.providers.status.notConfigured',
                                  )}
                            </span>
                          </button>
                          {isOpen
                            ? (
                                <div className="space-y-4 border-t border-border/50 px-3 py-3">
                                  {provider.slots.map(
                                    ({ definition: slotDefinition, state }) => (
                                      <TokenSlotField
                                        key={slotDefinition.id}
                                        definition={slotDefinition}
                                        slot={state}
                                        disabled={disableProviderFields}
                                      />
                                    ),
                                  )}
                                </div>
                              )
                            : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            : groupSlots.length > 0
              ? (
                  groupSlots.map(({ definition: slotDefinition, state }) => (
                    <TokenSlotField
                      key={slotDefinition.id}
                      definition={slotDefinition}
                      slot={state}
                      disabled={isLoading}
                    />
                  ))
                )
              : definition.emptyStateKey
                ? (
                    <p className="text-sm text-text-tertiary">
                      {t(definition.emptyStateKey)}
                    </p>
                  )
                : null}
        </SettingSectionCard>
      ))}
    </div>
  )
}
