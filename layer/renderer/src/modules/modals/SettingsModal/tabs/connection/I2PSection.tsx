import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'

import {
  SettingField,
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface I2PSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const I2PSection = ({ prefs, onPrefsChange }: I2PSectionProps) => {
  const { t } = useTranslation('setting')
  // Prefer known keys if they exist in the runtime API; fall back safely via `any` to avoid TS reliance
  const i2pEnabled = Boolean((prefs as any).i2p_enabled)
  const i2pHost = ((prefs as any).i2p_address ??
    (prefs as any).i2p_host ??
    '127.0.0.1') as string
  const i2pPort = ((prefs as any).i2p_port ?? 7656) as number
  const i2pMixedMode = Boolean((prefs as any).i2p_mixed_mode)

  const handleChange = (updates: Record<string, unknown>) => {
    // Cast to any to pass through unknown preference keys
    ;(onPrefsChange as any)(updates)
  }

  return (
    <SettingSectionCard title={t('connection.i2p.title')} enabled={i2pEnabled}>
      <SettingSwitchField
        label={t('connection.i2p.enabled')}
        checked={i2pEnabled}
        onCheckedChange={(v) => handleChange({ i2p_enabled: Boolean(v) })}
      />
      <SettingField label={t('connection.i2p.host')}>
        <Input
          value={i2pHost}
          onChange={(e) =>
            handleChange({
              i2p_address: e.target.value,
              i2p_host: e.target.value,
            })
          }
          className="w-32"
        />
      </SettingField>
      <SettingInputField
        label={t('connection.i2p.port')}
        type="number"
        value={String(i2pPort)}
        onChange={(v) => handleChange({ i2p_port: Number.parseInt(v) || 7656 })}
      />
      <SettingSwitchField
        id="i2p_mixed_mode"
        label={t('connection.i2p.mixedMode')}
        checked={i2pMixedMode}
        onCheckedChange={(v) => handleChange({ i2p_mixed_mode: Boolean(v) })}
      />
    </SettingSectionCard>
  )
}
