import { app } from 'electron'

import { BridgeService } from '../services/bridge-service'
import { RendererLifecycleManager } from './renderer-lifecycle'
import { WindowManager } from './window-manager'

export class DeeplinkManager {
  public static instance: DeeplinkManager = new DeeplinkManager()

  private pendingMagnetOpens: string[] = []
  private pendingMagnetPayloads: Array<{ links: string[] }> = []

  private constructor() {}

  initialize(): void {
    // macOS deeplink (magnet) can arrive before ready
    app.on('open-url', (event, url) => {
      event.preventDefault()
      if (typeof url === 'string' && url.toLowerCase().startsWith('magnet:')) {
        if (app.isReady()) {
          void this.handleMagnetOpens([url])
        } else {
          this.pendingMagnetOpens.push(url)
        }
      }
    })

    RendererLifecycleManager.instance.onReady(() => {
      void this.flushPendingMagnetOpens()
      this.flushPendingMagnetPayloads()
    })
  }

  registerProtocolClient(): void {
    try {
      if (app.isPackaged) {
        app.setAsDefaultProtocolClient?.('magnet')
      }
    } catch (e) {
      console.warn('registerProtocolClient failed:', e)
    }
  }

  processInitialArgv(argv: string[]): void {
    const magnets = this.extractMagnetsFromArgv(argv)
    if (magnets.length > 0) {
      this.pendingMagnetOpens.push(...magnets)
    }
  }

  handleSecondInstance(argv: string[]): void {
    const magnets = this.extractMagnetsFromArgv(argv)
    if (magnets.length > 0) {
      void this.handleMagnetOpens(magnets)
    }
  }

  private extractMagnetsFromArgv(argv: string[]): string[] {
    const out: string[] = []
    for (const arg of argv ?? []) {
      if (typeof arg === 'string' && arg.toLowerCase().startsWith('magnet:')) {
        out.push(arg)
      }
    }
    return out
  }

  private async flushPendingMagnetOpens(): Promise<void> {
    if (this.pendingMagnetOpens.length === 0) return
    const links = [...this.pendingMagnetOpens]
    this.pendingMagnetOpens = []
    await this.handleMagnetOpens(links)
  }

  private flushPendingMagnetPayloads(): void {
    if (this.pendingMagnetPayloads.length === 0) return
    for (const payload of this.pendingMagnetPayloads) {
      BridgeService.shared.broadcast('deeplink:magnet', payload)
    }
    this.pendingMagnetPayloads = []
  }

  async handleMagnetOpens(links: string[]): Promise<void> {
    if (!links || links.length === 0) return
    await WindowManager.getInstance().showMainWindow()

    const normalized = Array.from(
      new Set(
        links
          .filter(Boolean)
          .map((l) => l.trim())
          .filter((l) => l.toLowerCase().startsWith('magnet:')),
      ),
    )
    if (normalized.length === 0) return

    const payload = { links: normalized }
    if (!RendererLifecycleManager.instance.isReady()) {
      this.pendingMagnetPayloads.push(payload)
      return
    }
    BridgeService.shared.broadcast('deeplink:magnet', payload)
  }
}
