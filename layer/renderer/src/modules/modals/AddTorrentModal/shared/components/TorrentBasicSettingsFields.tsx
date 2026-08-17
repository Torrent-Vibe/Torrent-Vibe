import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'
import { ComboboxSelect } from '~/components/ui/select/ComboboxSelect'

import type { TorrentFormData, TorrentFormHandlers } from '../../types'

interface TorrentBasicSettingsFieldsProps {
  categories?: Record<string, { name: string; savePath: string }> | null
  className?: string
  formData: TorrentFormData
  handlers: TorrentFormHandlers
  showRename?: boolean
}

export const TorrentBasicSettingsFields = ({
  formData,
  handlers,
  categories,
  showRename = true,
  className,
}: TorrentBasicSettingsFieldsProps) => {
  const { t } = useTranslation()

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label disabled={formData.autoTMM} variant="form">
            {t('addTorrent.settingsPanel.savePath')}
          </Label>
          <Input
            disabled={formData.autoTMM}
            id="save-path"
            inputClassName="disabled:text-placeholder-text"
            placeholder={t('addTorrent.settingsPanel.savePathPlaceholder')}
            type="text"
            value={formData.savepath || ''}
            onChange={(e) =>
              handlers.setFormData((prev) => ({
                ...prev,
                savepath: e.target.value,
              }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label variant="form">{t('addTorrent.settingsPanel.category')}</Label>
          <ComboboxSelect
            allowCustom={true}
            customInputPlaceholder="Enter category name..."
            placeholder={t('addTorrent.settingsPanel.categoryPlaceholder')}
            value={formData.category || ''}
            customInputDescription={t(
              'addTorrent.settingsPanel.customCategory.description',
            )}
            customInputTitle={t(
              'addTorrent.settingsPanel.customCategory.title',
            )}
            options={
              categories
                ? ['', ...Object.values(categories).map((c) => c.name)]
                : ['']
            }
            onValueChange={(value) =>
              handlers.setFormData((prev) => ({
                ...prev,
                category: value,
              }))
            }
          />
        </div>

        {showRename && (
          <div className="space-y-2 md:col-span-2">
            <Label variant="form">{t('addTorrent.settingsPanel.rename')}</Label>
            <Input
              id="rename"
              placeholder={t('addTorrent.settingsPanel.renamePlaceholder')}
              type="text"
              value={formData.rename}
              onChange={(e) =>
                handlers.setFormData((prev) => ({
                  ...prev,
                  rename: e.target.value,
                }))
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
