import { atom } from 'jotai'

export interface DragDropState {
  isDragging: boolean
  isDragOver: boolean
  hasValidFiles: boolean
}

export const dragDropStateAtom = atom<DragDropState>({
  isDragging: false,
  isDragOver: false,
  hasValidFiles: false,
})
