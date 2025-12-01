import { useAtom } from 'jotai'
import { useEffect, useRef } from 'react'

import { dragDropStateAtom } from '~/atoms/drag-drop'
import { Modal, modalItemsAtom } from '~/components/ui/modal/ModalManager'
import { jotaiStore } from '~/lib/jotai'
import { AddTorrentModal } from '~/modules/modals/AddTorrentModal'

export const GlobalDropProvider = () => {
  const [dragDropState, setDragDropState] = useAtom(dragDropStateAtom)
  const dragCounterRef = useRef(0)
  const timeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      const hasAnyModalOpen = jotaiStore.get(modalItemsAtom).length > 0
      if (hasAnyModalOpen) return

      const types = event.dataTransfer?.types
      const hasFiles = types
        ? (Array.prototype.indexOf.call(types, 'Files') as number) !== -1
        : false

      if (hasFiles) {
        dragCounterRef.current++

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        setDragDropState({
          isDragging: true,
          isDragOver: false,
          hasValidFiles: true,
        })
      }
    }

    const handleDragOver = (event: DragEvent) => {
      const hasAnyModalOpen = jotaiStore.get(modalItemsAtom).length > 0

      if (hasAnyModalOpen) return

      const types = event.dataTransfer?.types
      const hasFiles = types
        ? (Array.prototype.indexOf.call(types, 'Files') as number) !== -1
        : false

      if (hasFiles) {
        event.preventDefault()

        if (dragDropState.isDragging) {
          setDragDropState((prev) => ({
            ...prev,
            isDragOver: true,
          }))
        }
      }
    }

    const handleDragLeave = (_event: DragEvent) => {
      const hasAnyModalOpen = jotaiStore.get(modalItemsAtom).length > 0
      if (hasAnyModalOpen) return

      dragCounterRef.current--

      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0

        // 延迟重置状态，避免在元素之间快速移动时闪烁
        timeoutRef.current = window.setTimeout(() => {
          setDragDropState({
            isDragging: false,
            isDragOver: false,
            hasValidFiles: false,
          })
        }, 100)
      } else {
        // 仍在拖拽区域内，但不在当前元素上
        setDragDropState((prev) => ({
          ...prev,
          isDragOver: false,
        }))
      }
    }

    const handleDrop = (event: DragEvent) => {
      const { dataTransfer } = event
      if (!dataTransfer) return

      // 重置拖拽状态
      dragCounterRef.current = 0
      setDragDropState({
        isDragging: false,
        isDragOver: false,
        hasValidFiles: false,
      })

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      const files = Array.from(dataTransfer.files || [])

      const torrentFiles = files.filter((f) =>
        f.name.toLowerCase().endsWith('.torrent'),
      )

      if (torrentFiles.length === 0) return

      const hasAnyModalOpen = jotaiStore.get(modalItemsAtom).length > 0
      if (hasAnyModalOpen) return

      event.preventDefault()
      event.stopPropagation()

      Modal.present(AddTorrentModal, { initialFiles: torrentFiles })
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [dragDropState.isDragging, setDragDropState])

  return null
}
