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
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
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
            type="number"
            value={prefs.listen_port || 47050}
            onChange={(e) =>
              onPrefsChange({
                listen_port: Number.parseInt(e.target.value) || 47050,
              })
            }
            min={1024}
            max={65535}
            className="w-24"
          />
          <Button variant="secondary" size="sm" onClick={handleRandomPort}>
            {t('connection.port.random')}
          </Button>
        </div>
      </SettingField>
      <SettingSwitchField
        id="upnp"
        label={t('connection.port.upnp')}
        checked={Boolean(prefs.upnp)}
        onCheckedChange={(v) => onPrefsChange({ upnp: Boolean(v) })}
      />
    </SettingSectionCard>
  )
}
