import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'

import { getHelperConfig, putHelperConfig } from './api'
import { getHelperBinding } from './bindings'

export const HelperConfigForm = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation('app')
  const [libraryRoot, setLibraryRoot] = useState('')
  const [category, setCategory] = useState('Bangumi')
  const [qbitUrl, setQbitUrl] = useState('')
  const [qbitUser, setQbitUser] = useState('')
  const [qbitPass, setQbitPass] = useState('')
  const [pollIntervalMs, setPollIntervalMs] = useState('600000')
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
        setPollIntervalMs(String(config.pollIntervalMs))
      })
      .catch(() => {
        toast.error(t('servers.helper.configSaveFailed'))
      })
  }, [serverId, t])

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text">
        {t('servers.helper.configTitle')}
      </p>
      <Label variant="form">{t('servers.helper.libraryRoot')}</Label>
      <Input
        value={libraryRoot}
        onChange={event => setLibraryRoot(event.target.value)}
      />
      <p className="text-xs text-text-tertiary">
        {t('servers.helper.libraryRootHint')}
      </p>
      <Label variant="form">{t('servers.helper.category')}</Label>
      <Input
        value={category}
        onChange={event => setCategory(event.target.value)}
      />
      <Label variant="form">{t('servers.helper.qbitUrl')}</Label>
      <Input
        value={qbitUrl}
        onChange={event => setQbitUrl(event.target.value)}
      />
      <Label variant="form">{t('servers.helper.qbitUser')}</Label>
      <Input
        value={qbitUser}
        onChange={event => setQbitUser(event.target.value)}
      />
      <Label variant="form">{t('servers.helper.qbitPass')}</Label>
      <Input
        type="password"
        value={qbitPass}
        onChange={event => setQbitPass(event.target.value)}
      />
      <Button
        size="sm"
        disabled={busy}
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
  )
}
