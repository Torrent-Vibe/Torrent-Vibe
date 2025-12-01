import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { qbQueryManager } from '~/lib/query/query-manager-instance'
import {
  createConnectionConfig,
  validateConnection,
} from '~/modules/connection/validation'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import {
  getInitialQBittorrentConfig,
  loadStoredConnectionConfig,
  saveStoredConnectionConfig,
} from '~/shared/config'

import { SettingInputField, SettingSwitchField } from '.'

export const WebConnectionSection = () => {
  const { t } = useTranslation('setting')

  const initial = useMemo(() => getInitialQBittorrentConfig(), [])
  const saved = useMemo(() => loadStoredConnectionConfig().stored, [])

  const [host, setHost] = useState(initial.host || '')
  const [port, setPort] = useState<number | ''>(initial.port || '')
  const [username, setUsername] = useState(initial.username || '')
  const [password, setPassword] = useState(initial.password || '')
  const [useHttps, setUseHttps] = useState(initial.useHttps ?? true)
  const [useCurrentPath, setUseCurrentPath] = useState<boolean>(
    Boolean(initial.baseUrl),
  )
  const [rememberPassword, setRememberPassword] = useState(
    saved?.rememberPassword ?? false,
  )
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)

  const canSave = Boolean(username && (useCurrentPath || (host && port)))

  const onSave = async () => {
    if (!canSave) return

    setSaving(true)
    setValidating(true)

    try {
      const resolvedHost = useCurrentPath ? window.location.hostname : host
      const resolvedPort = useCurrentPath
        ? Number(window.location.port) ||
          (window.location.protocol === 'https:' ? 443 : 80)
        : Number(port)

      const configData = {
        host: resolvedHost,
        port: resolvedPort,
        username,
        password,
        useHttps: useCurrentPath
          ? window.location.protocol === 'https:'
          : useHttps,
        useCurrentPath,
      }

      const validationResult = await validateConnection(
        createConnectionConfig(configData),
      )
      setValidating(false)

      if (!validationResult.success) {
        return
      }

      const config = createConnectionConfig(configData)
      saveStoredConnectionConfig(config, rememberPassword)
      QBittorrentClient.configure(config)

      await qbQueryManager.scenarios.onConnectionChange()
    } catch {
      setValidating(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-text mb-1">
        {t('general.connection.title')}
      </h2>

      <div className="space-y-3">
        <SettingSwitchField
          id="useCurrentPath"
          label={t('general.connection.useCurrentPath.label')}
          checked={useCurrentPath}
          onCheckedChange={(v) => setUseCurrentPath(Boolean(v))}
        />

        <SettingInputField
          id="host"
          label={t('general.connection.host.label')}
          placeholder={t('general.connection.host.placeholder')}
          value={host}
          onChange={(v) => setHost(v)}
          disabled={useCurrentPath}
          required={!useCurrentPath}
        />

        <SettingInputField
          id="port"
          label={t('general.connection.port.label')}
          placeholder={t('general.connection.port.placeholder')}
          value={port}
          inputMode="numeric"
          onChange={(v) => setPort(v ? Number(v) : '')}
          disabled={useCurrentPath}
          required={!useCurrentPath}
        />

        <SettingInputField
          id="username"
          label={t('general.connection.username.label')}
          placeholder={t('general.connection.username.placeholder')}
          value={username}
          onChange={(v) => setUsername(v)}
        />

        <SettingInputField
          id="password"
          label={t('general.connection.password.label')}
          placeholder={t('general.connection.password.placeholder')}
          type="password"
          value={password}
          onChange={(v) => setPassword(v)}
        />

        <SettingSwitchField
          id="https"
          label={t('general.connection.useHttps.label')}
          checked={
            window.location.protocol === 'https:' || useHttps || useCurrentPath
          }
          disabled={window.location.protocol === 'https:' || useCurrentPath}
          onCheckedChange={(v) => setUseHttps(Boolean(v))}
        />

        <SettingSwitchField
          id="remember"
          label={t('general.connection.rememberPassword.label')}
          checked={rememberPassword}
          onCheckedChange={(v) => setRememberPassword(Boolean(v))}
        />

        <div className="pt-4 flex justify-end">
          <Button onClick={onSave} disabled={!canSave || saving} size="sm">
            {saving && validating && (
              <i className="i-mingcute-loading-3-line mr-2 animate-spin text-sm" />
            )}
            <span>
              {saving
                ? validating
                  ? t('general.connection.buttons.validating')
                  : t('general.connection.buttons.saving')
                : t('general.connection.buttons.save')}
            </span>
          </Button>
        </div>
      </div>
    </section>
  )
}
