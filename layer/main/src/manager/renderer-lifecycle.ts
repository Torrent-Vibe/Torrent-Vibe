import { ipcMain } from 'electron'

/**
 * Singleton manager that tracks renderer readiness and notifies subscribers.
 */
export class RendererLifecycleManager {
  public static instance: RendererLifecycleManager =
    new RendererLifecycleManager()
  private ready = false
  private emitter = new EventTarget()

  private constructor() {}

  initialize(): void {
    // Idempotent
    ipcMain.removeAllListeners('renderer:ready')
    ipcMain.on('renderer:ready', () => {
      this.ready = true
      this.emitter.dispatchEvent(new Event('ready'))
    })
  }

  isReady(): boolean {
    return this.ready
  }

  onReady(callback: () => void): () => void {
    if (this.ready) {
      callback()
      return () => {}
    }
    this.emitter.addEventListener('ready', callback)
    return () => this.emitter.removeEventListener('ready', callback)
  }
}
