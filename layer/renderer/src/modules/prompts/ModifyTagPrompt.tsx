import { getI18n } from '~/i18n'

import { Prompt } from '../../components/ui/prompts/Prompt'

export interface ModifyTagOptions {
  tagName: string
  onConfirm: (newTagName: string) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

export const ModifyTagPrompt = {
  show({ tagName, onConfirm, onCancel }: ModifyTagOptions) {
    const { t } = getI18n()

    return Prompt.input({
      title: t('modals.modifyTag.title'),
      description: `Enter a new name for tag "${tagName}"`,
      defaultValue: tagName,
      placeholder: 'Enter new tag name...',
      onConfirmText: t('buttons.save'),
      onCancelText: t('buttons.cancel'),
      onConfirm,
      onCancel,
    })
  },
}
