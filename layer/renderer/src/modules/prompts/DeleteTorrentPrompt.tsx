import { Checkbox } from '~/components/ui/checkbox/Checkbox'
import { getI18n } from '~/i18n'

import { Prompt } from '../../components/ui/prompts/Prompt'

export interface DeleteTorrentOptions {
  onCancel?: () => void | Promise<void>
  onConfirm: (deleteFiles: boolean) => void | Promise<void>
  torrentName: string
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
            id="delete-files-checkbox"
            onCheckedChange={(checked) => {
              deleteFiles = checked === 'indeterminate' ? false : checked
            }}
          />
          <label
            className="text-sm cursor-pointer"
            htmlFor="delete-files-checkbox"
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
