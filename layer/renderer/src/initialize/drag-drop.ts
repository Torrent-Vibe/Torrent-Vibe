export const initializeDragAndDropGuards = () => {
  // Prevent default browser behavior of opening files when dropped onto the window.
  // Do not stop propagation so app-level drop handlers still receive the events.
  const preventDefault = (event: DragEvent) => {
    event.preventDefault()
  }
  window.addEventListener('dragover', preventDefault)
  window.addEventListener('drop', preventDefault)

  return () => {
    window.removeEventListener('dragover', preventDefault)
    window.removeEventListener('drop', preventDefault)
  }
}
