import { useTranslation } from 'react-i18next'

import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'
import { ComboboxSelect } from '~/components/ui/select/ComboboxSelect'

import type { TorrentFormData, TorrentFormHandlers } from '../../types'

interface TorrentBasicSettingsFieldsProps {
  formData: TorrentFormData
  handlers: TorrentFormHandlers
  categories?: Record<string, { name: string; savePath: string }> | null
  showRename?: boolean
  className?: string
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
          <Label variant="form" disabled={formData.autoTMM}>
            {t('addTorrent.settingsPanel.savePath')}
          </Label>
          <Input
            disabled={formData.autoTMM}
            id="save-path"
            type="text"
            placeholder={t('addTorrent.settingsPanel.savePathPlaceholder')}
            inputClassName="disabled:text-placeholder-text"
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
            value={formData.category || ''}
            onValueChange={(value) =>
              handlers.setFormData((prev) => ({
                ...prev,
                category: value,
              }))
            }
            placeholder={t('addTorrent.settingsPanel.categoryPlaceholder')}
            options={
              categories
                ? ['', ...Object.values(categories).map((c) => c.name)]
                : ['']
            }
            allowCustom={true}
            customInputTitle={t(
              'addTorrent.settingsPanel.customCategory.title',
            )}
            customInputDescription={t(
              'addTorrent.settingsPanel.customCategory.description',
            )}
            customInputPlaceholder="Enter category name..."
          />
        </div>

        {showRename && (
          <div className="space-y-2 md:col-span-2">
            <Label variant="form">{t('addTorrent.settingsPanel.rename')}</Label>
            <Input
              id="rename"
              type="text"
              placeholder={t('addTorrent.settingsPanel.renamePlaceholder')}
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
