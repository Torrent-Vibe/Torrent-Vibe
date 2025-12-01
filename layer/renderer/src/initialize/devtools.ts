export const initializeDevTools = async () => {
  if (import.meta.env.DEV) {
    const { start } = await import('react-scan')
    start()
  }
}
