import { Modal } from '~/components/ui/modal'

import { TagsSelectDialog } from './TagsSelectDialog'

export interface TagsSelectOptions {
  currentTags?: string[]
  title?: string
  onConfirm: (tags: string[]) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

export const TagsSelectPrompt = {
  show({ currentTags, title, onConfirm, onCancel }: TagsSelectOptions): string {
    return Modal.present(TagsSelectDialog, {
      currentTags,
      title,
      onConfirm: async (tags: string[]) => {
        await onConfirm(tags)
      },
      onClose: async () => {
        await onCancel?.()
      },
    })
  },
}
