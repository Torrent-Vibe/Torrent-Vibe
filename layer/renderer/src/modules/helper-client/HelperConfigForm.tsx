import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import {
  SettingInputField,
  SettingSwitchField,
} from '~/modules/modals/SettingsModal/tabs/components'

import { getHelperConfig, putHelperConfig } from './api'
import { getHelperBinding } from './bindings'

export const HelperConfigForm = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation('app')
  const [libraryRoot, setLibraryRoot] = useState('')
  const [category, setCategory] = useState('Bangumi')
  const [qbitUrl, setQbitUrl] = useState('')
  const [qbitUser, setQbitUser] = useState('')
  const [qbitPass, setQbitPass] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [pollIntervalMs, setPollIntervalMs] = useState('600000')
  const [organizeOnComplete, setOrganizeOnComplete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const binding = getHelperBinding(serverId)
    if (!binding) {
      return
    }
    void getHelperConfig(binding.url, binding.token)
      .then((config) => {
        setLibraryRoot(config.libraryRoot)
        setCategory(config.category)
        setQbitUrl(config.qbitUrl)
        setQbitUser(config.qbitUser)
        setProxyUrl(config.proxyUrl)
        setPollIntervalMs(String(config.pollIntervalMs))
        setOrganizeOnComplete(config.organizeOnComplete)
      })
      .catch(() => {
        toast.error(t('servers.helper.configSaveFailed'))
      })
  }, [serverId, t])

  return (
    <div className="space-y-3">
      <SettingInputField
        dense
        description={t('servers.helper.libraryRootHint')}
        id="helper-library-root"
        label={t('servers.helper.libraryRoot')}
        value={libraryRoot}
        onChange={setLibraryRoot}
      />
      <SettingInputField
        dense
        id="helper-category"
        label={t('servers.helper.category')}
        value={category}
        onChange={setCategory}
      />
      <SettingInputField
        dense
        id="helper-qbit-url"
        label={t('servers.helper.qbitUrl')}
        placeholder="http://127.0.0.1:8080"
        value={qbitUrl}
        onChange={setQbitUrl}
      />
      <SettingInputField
        dense
        id="helper-qbit-user"
        label={t('servers.helper.qbitUser')}
        value={qbitUser}
        onChange={setQbitUser}
      />
      <SettingInputField
        dense
        description={t('servers.helper.qbitPassHint')}
        id="helper-qbit-pass"
        label={t('servers.helper.qbitPass')}
        type="password"
        value={qbitPass}
        onChange={setQbitPass}
      />
      <SettingInputField
        dense
        description={t('servers.helper.proxyUrlHint')}
        id="helper-proxy-url"
        label={t('servers.helper.proxyUrl')}
        placeholder="socks5://127.0.0.1:7891"
        value={proxyUrl}
        onChange={setProxyUrl}
      />
      <SettingSwitchField
        checked={organizeOnComplete}
        description={t('servers.helper.organizeOnCompleteHint')}
        id="helper-organize-on-complete"
        label={t('servers.helper.organizeOnComplete')}
        onCheckedChange={setOrganizeOnComplete}
      />

      <div className="flex justify-end border-t border-border/60 pt-3">
        <Button
          disabled={busy}
          size="sm"
          onClick={() => {
            const binding = getHelperBinding(serverId)
            if (!binding) {
              return
            }
            setBusy(true)
            void putHelperConfig(binding.url, binding.token, {
              libraryRoot,
              category,
              qbitUrl,
              qbitUser,
              pollIntervalMs: Number(pollIntervalMs) || 600_000,
              proxyUrl,
              organizeOnComplete,
              ...(qbitPass ? { qbitPass } : {}),
            })
              .then(() => {
                toast.success(t('servers.helper.configSaved'))
                setQbitPass('')
              })
              .catch(() => {
                toast.error(t('servers.helper.configSaveFailed'))
              })
              .finally(() => {
                setBusy(false)
              })
          }}
        >
          {t('servers.helper.saveConfig')}
        </Button>
      </div>
    </div>
  )
}
