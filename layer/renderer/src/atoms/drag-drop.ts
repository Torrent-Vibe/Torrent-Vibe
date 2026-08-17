import { atom } from 'jotai'

export interface DragDropState {
  hasValidFiles: boolean
  isDragging: boolean
  isDragOver: boolean
}

export const dragDropStateAtom = atom<DragDropState>({
  isDragging: false,
  isDragOver: false,
  hasValidFiles: false,
})
