import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'

import { TorrentBasicSettingsFields } from './shared/components/TorrentBasicSettingsFields'
import { TorrentOptionToggle } from './shared/components/TorrentOptionToggle'
import type { TorrentFormData, TorrentFormHandlers } from './types'

interface TorrentSettingsProps {
  formData: TorrentFormData
  handlers: TorrentFormHandlers
  categories?: Record<string, { name: string; savePath: string }> | null
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
        formData={formData}
        handlers={handlers}
        categories={categories}
      />

      {/* Options Section */}
      <div className="space-y-3">
        <Label className="text-sm font-medium flex items-center gap-2">
          <i className="i-mingcute-settings-2-line text-text-secondary" />
          {t('addTorrent.settingsPanel.options')}
        </Label>

        <div className="space-y-3">
          <TorrentOptionToggle
            id="auto-tmm"
            checked={!!formData.autoTMM}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                autoTMM: checked,
              }))
            }
            label={t('addTorrent.settingsPanel.autoTMM')}
          />

          <TorrentOptionToggle
            id="start-torrent"
            checked={formData.startTorrent}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                startTorrent: checked,
              }))
            }
            label={t('addTorrent.settingsPanel.startTorrent')}
          />

          <TorrentOptionToggle
            id="skip-hash-check"
            checked={!!formData.skip_checking}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                skip_checking: checked,
              }))
            }
            label={t('addTorrent.settingsPanel.skipHashCheck')}
          />

          <TorrentOptionToggle
            id="sequential-download"
            checked={!!formData.sequentialDownload}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                sequentialDownload: checked,
              }))
            }
            label={t('addTorrent.settingsPanel.sequentialDownload')}
          />

          <TorrentOptionToggle
            id="first-last-piece"
            checked={!!formData.firstLastPiecePrio}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                firstLastPiecePrio: checked,
              }))
            }
            label={t('addTorrent.settingsPanel.firstLastPiecePrio')}
          />

          <TorrentOptionToggle
            id="root-folder"
            checked={!!formData.root_folder}
            onChange={(checked) =>
              handlers.setFormData((prev) => ({
                ...prev,
                root_folder: checked,
              }))
            }
            label={t('addTorrent.settingsPanel.createRootFolder')}
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
              variant="form"
              className="text-xs text-text-secondary font-normal"
            >
              {t('addTorrent.settingsPanel.downloadLimit')}
            </Label>
            <Input
              type="number"
              min="0"
              placeholder={t('addTorrent.settingsPanel.unlimited')}
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
              variant="form"
              className="text-xs text-text-secondary font-normal"
            >
              {t('addTorrent.settingsPanel.uploadLimit')}
            </Label>
            <Input
              type="number"
              min="0"
              placeholder={t('addTorrent.settingsPanel.unlimited')}
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
