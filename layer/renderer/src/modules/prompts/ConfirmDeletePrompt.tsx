import { Prompt } from '../../components/ui/prompts/Prompt'

export interface ConfirmDeleteOptions {
  itemName: string
  itemType?: 'category' | 'tag' | 'item'
  onCancel?: () => void | Promise<void>
  onConfirm: () => void | Promise<void>
  title: string
}

export const ConfirmDeletePrompt = {
  show({
    title,
    itemName,
    itemType = 'item',
    onConfirm,
    onCancel,
  }: ConfirmDeleteOptions) {
    return Prompt.prompt({
      title,
      description: `Are you sure you want to delete the ${itemType} "${itemName}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirmText: 'Delete',
      onCancelText: 'Cancel',
      onConfirm,
      onCancel,
    })
  },
}
