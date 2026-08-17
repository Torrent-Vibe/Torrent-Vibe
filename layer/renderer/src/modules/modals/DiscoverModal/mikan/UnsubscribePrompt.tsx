import { Checkbox } from '~/components/ui/checkbox/Checkbox'
import { Prompt } from '~/components/ui/prompts/Prompt'
import { getI18n } from '~/i18n'

export const UnsubscribePrompt = {
  show({
    title,
    onConfirm,
    onCancel,
  }: {
    onCancel?: () => void | Promise<void>
    onConfirm: (deleteFiles: boolean) => void | Promise<void>
    title: string
  }) {
    let deleteFiles = false
    const { t } = getI18n()

    return Prompt.prompt({
      title: t('discover.modal.mikan.unsubscribeTitle'),
      description: t('discover.modal.mikan.unsubscribeConfirm', { title }),
      variant: 'danger',
      onConfirmText: t('discover.modal.mikan.unsubscribe'),
      onCancelText: t('buttons.cancel'),
      content: (
        <div className="flex items-center gap-2">
          <Checkbox
            defaultChecked={false}
            id="unsubscribe-delete-files-checkbox"
            onCheckedChange={(checked) => {
              deleteFiles = checked === 'indeterminate' ? false : checked
            }}
          />
          <label
            className="cursor-pointer text-sm"
            htmlFor="unsubscribe-delete-files-checkbox"
          >
            {t('discover.modal.mikan.unsubscribeDeleteFiles')}
          </label>
        </div>
      ),
      onConfirm: () => onConfirm(deleteFiles),
      onCancel,
    })
  },
}
