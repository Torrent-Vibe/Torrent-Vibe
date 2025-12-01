import { getI18n } from '~/i18n'

import { Prompt } from '../../components/ui/prompts/Prompt'

export interface ModifyCategoryOptions {
  categoryName: string
  currentSavePath?: string
  onConfirm: (newSavePath: string) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

export const ModifyCategoryPrompt = {
  show({
    categoryName,
    currentSavePath = '',
    onConfirm,
    onCancel,
  }: ModifyCategoryOptions) {
    const { t } = getI18n()

    return Prompt.input({
      title: t('modals.modifyCategory.title'),
      description: `Update the save path for category "${categoryName}"`,
      defaultValue: currentSavePath,
      placeholder: 'Enter new save path...',
      onConfirmText: t('buttons.save'),
      onCancelText: t('buttons.cancel'),
      onConfirm,
      onCancel,
    })
  },
}
