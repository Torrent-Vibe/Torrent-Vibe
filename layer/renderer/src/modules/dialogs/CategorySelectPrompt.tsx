import { Modal } from '~/components/ui/modal'

import { CategorySelectDialog } from './CategorySelectDialog'

export interface CategorySelectOptions {
  currentCategory?: string
  title?: string
  onConfirm: (category: string) => void | Promise<void>
}

export const CategorySelectPrompt = {
  show({ currentCategory, title, onConfirm }: CategorySelectOptions): string {
    return Modal.present(CategorySelectDialog, {
      currentCategory,
      title,
      onConfirm: async (category: string) => {
        await onConfirm(category)
      },
      onClose: async () => {},
    })
  },
}
