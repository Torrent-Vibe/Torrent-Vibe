import type { Preferences } from '@innei/qbittorrent-browser'
import { useTranslation } from 'react-i18next'

import {
  SettingField,
  SettingInputField,
  SettingSectionCard,
  SettingSwitchField,
} from '../components'

interface ExternalProgramsSectionProps {
  prefs: Partial<Preferences>
  onPrefsChange: (updates: Partial<Preferences>) => void
}

export const ExternalProgramsSection = ({
  prefs,
  onPrefsChange,
}: ExternalProgramsSectionProps) => {
  const { t } = useTranslation('setting')
  return (
    <SettingSectionCard title={t('downloads.programs.title')}>
      <SettingSwitchField
        id="autorun_on_add"
        label={t('downloads.programs.onAdd')}
        checked={false}
        onCheckedChange={() => {}}
      />
      <SettingInputField
        label={'Command'}
        value={''}
        onChange={() => {}}
        placeholder="/path/to/program --args"
        disabled
      />
      <SettingField label="">
        <div className="text-xs text-text-secondary">
          {t('downloads.programs.notSupported')}
        </div>
      </SettingField>

      <SettingSectionCard
        title={t('downloads.programs.onComplete')}
        enabled={Boolean(prefs.autorun_enabled)}
        onToggleEnabled={(v) => onPrefsChange({ autorun_enabled: Boolean(v) })}
      >
        <SettingInputField
          label={'Command'}
          value={prefs.autorun_program ?? ''}
          onChange={(v) => onPrefsChange({ autorun_program: v })}
          placeholder="/path/to/program --args"
        />
      </SettingSectionCard>

      <div className="p-3 bg-fill/5 rounded-lg text-xs text-text-secondary">
        <div className="font-medium mb-1">
          {t('downloads.programs.parameters')}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>%N: Torrent name</div>
          <div>%L: Category</div>
          <div>%G: Tags (space separated)</div>
          <div>
            %F: Content path (same as root path for single file torrents)
          </div>
          <div>%R: Root path (first torrent subdirectory path)</div>
          <div>%D: Save path</div>
          <div>%C: File count</div>
          <div>%Z: Torrent size (bytes)</div>
          <div>%T: Current tracker</div>
          <div>%I: Info hash v1</div>
          <div>%J: Info hash v2</div>
          <div>%K: Torrent ID</div>
        </div>
        <div className="mt-2 font-medium">{t('downloads.programs.tip')}</div>
      </div>
    </SettingSectionCard>
  )
}
