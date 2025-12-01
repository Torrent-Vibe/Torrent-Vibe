import { Checkbox } from '~/components/ui/checkbox/Checkbox'
import { getI18n } from '~/i18n'

import { Prompt } from '../../components/ui/prompts/Prompt'

export interface DeleteTorrentOptions {
  torrentName: string
  onConfirm: (deleteFiles: boolean) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

export const DeleteTorrentPrompt = {
  show({ torrentName, onConfirm, onCancel }: DeleteTorrentOptions) {
    let deleteFiles = false
    const { t } = getI18n()

    return Prompt.prompt({
      title: t('modals.deleteTorrent.title'),
      description: t('modals.deleteTorrent.description', { torrentName }),
      variant: 'danger',
      onConfirmText: t('buttons.delete'),
      onCancelText: t('buttons.cancel'),
      content: (
        <div className="flex items-center gap-2">
          <Checkbox
            defaultChecked={false}
            onCheckedChange={(checked) => {
              deleteFiles = checked === 'indeterminate' ? false : checked
            }}
            id="delete-files-checkbox"
          />
          <label
            htmlFor="delete-files-checkbox"
            className="text-sm cursor-pointer"
          >
            {t('modals.deleteTorrent.deleteFiles')}
          </label>
        </div>
      ),
      onConfirm: () => onConfirm(deleteFiles),
      onCancel,
    })
  },
}
