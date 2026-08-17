import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'

import { TorrentBasicSettingsFields } from './shared/components/TorrentBasicSettingsFields'
import { TorrentOptionToggle } from './shared/components/TorrentOptionToggle'
import type { TorrentFormData, TorrentFormHandlers } from './types'

interface TorrentSettingsProps {
  categories?: Record<string, { name: string; savePath: string }> | null
  formData: TorrentFormData
  handlers: TorrentFormHandlers
}

export const TorrentSettings = ({
  formData,
  handlers,
  categories,
}: TorrentSettingsProps) => {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Settings Header - aligned with left side */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <i className="i-mingcute-settings-1-line text-text-secondary" />
          {t('addTorrent.settingsPanel.title')}
        </Label>
        <p className="text-xs text-text-secondary">
          {t('addTorrent.settingsPanel.description')}
        </p>
      </div>

      {/* Basic Settings Section */}
      <TorrentBasicSettingsFields
        categories={categories}
        formData={formData}
        handlers={handlers}
      />

      {/* Options Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <i className="i-mingcute-settings-2-line text-text-secondary" />
          {t('addTorrent.settingsPanel.options')}
        </Label>

        <div className="space-y-3">
          <TorrentOptionToggle
            checked={!!formData.autoTMM}
            id="auto-tmm"
            label={t('addTorrent.settingsPanel.autoTMM')}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                autoTMM: checked,
              }))
            }
          />

          <TorrentOptionToggle
            checked={formData.startTorrent}
            id="start-torrent"
            label={t('addTorrent.settingsPanel.startTorrent')}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                startTorrent: checked,
              }))
            }
          />

          <TorrentOptionToggle
            checked={!!formData.skip_checking}
            id="skip-hash-check"
            label={t('addTorrent.settingsPanel.skipHashCheck')}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                skip_checking: checked,
              }))
            }
          />

          <TorrentOptionToggle
            checked={!!formData.sequentialDownload}
            id="sequential-download"
            label={t('addTorrent.settingsPanel.sequentialDownload')}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                sequentialDownload: checked,
              }))
            }
          />

          <TorrentOptionToggle
            checked={!!formData.firstLastPiecePrio}
            id="first-last-piece"
            label={t('addTorrent.settingsPanel.firstLastPiecePrio')}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                firstLastPiecePrio: checked,
              }))
            }
          />

          <TorrentOptionToggle
            checked={!!formData.root_folder}
            id="root-folder"
            label={t('addTorrent.settingsPanel.createRootFolder')}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                root_folder: checked,
              }))
            }
          />
        </div>
      </div>

      {/* Speed Limits Section */}
      <div className="space-y-4">
        <Label className="text-sm font-medium flex items-center gap-2">
          <i className="i-lucide-cloud-download text-text-secondary" />
          {t('addTorrent.settingsPanel.speedLimits')}
        </Label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label
              className="text-xs text-text-secondary font-normal"
              variant="form"
            >
              {t('addTorrent.settingsPanel.downloadLimit')}
            </Label>
            <Input
              min="0"
              placeholder={t('addTorrent.settingsPanel.unlimited')}
              type="number"
              value={formData.limitDownloadKiBs}
              onChange={(e) =>
                handlers.setFormData((prev) => ({
                  ...prev,
                  limitDownloadKiBs: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label
              className="text-xs text-text-secondary font-normal"
              variant="form"
            >
              {t('addTorrent.settingsPanel.uploadLimit')}
            </Label>
            <Input
              min="0"
              placeholder={t('addTorrent.settingsPanel.unlimited')}
              type="number"
              value={formData.limitUploadKiBs}
              onChange={(e) =>
                handlers.setFormData((prev) => ({
                  ...prev,
                  limitUploadKiBs: e.target.value,
                }))
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
