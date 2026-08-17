import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'

import {
  SettingField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface ListeningPortSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const ListeningPortSection = ({
  prefs,
  onPrefsChange,
}: ListeningPortSectionProps) => {
  const { t } = useTranslation('setting')
  const handleRandomPort = () => {
    const randomPort = Math.floor(Math.random() * (65535 - 1024 + 1)) + 1024
    onPrefsChange({ listen_port: randomPort })
  }

  return (
    <SettingSectionCard title={t('connection.port.title')}>
      <SettingField label={t('connection.port.description')}>
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            max={65535}
            min={1024}
            type="number"
            value={prefs.listen_port || 47050}
            onChange={(e) =>
              onPrefsChange({
                listen_port: Number.parseInt(e.target.value) || 47050,
              })
            }
          />
          <Button size="sm" variant="secondary" onClick={handleRandomPort}>
            {t('connection.port.random')}
          </Button>
        </div>
      </SettingField>
      <SettingSwitchField
        checked={Boolean(prefs.upnp)}
        id="upnp"
        label={t('connection.port.upnp')}
        onCheckedChange={(v) => onPrefsChange({ upnp: Boolean(v) })}
      />
    </SettingSectionCard>
  )
}
