import { promises as fs } from 'node:fs'

import { app } from 'electron'
import { basename } from 'pathe'

import { BridgeService } from '../services/bridge-service'
import { RendererLifecycleManager } from './renderer-lifecycle'
import { WindowManager } from './window-manager'

export class FileOpenManager {
  public static instance: FileOpenManager = new FileOpenManager()

  private pendingTorrentOpens: string[] = []
  private pendingOpenFilePayloads: Array<{
    files: Array<{ name: string; data: Uint8Array; mime?: string }>
  }> = []

  private constructor() {}

  initialize(): void {
    // macOS: open-file can fire before ready; queue paths
    app.on('open-file', (event, path) => {
      event.preventDefault()
      if (path && path.toLowerCase().endsWith('.torrent')) {
        if (app.isReady()) {
          void this.handleTorrentFileOpens([path])
        } else {
          this.pendingTorrentOpens.push(path)
        }
      }
    })

    // Subscribe to renderer lifecycle to flush buffered events
    RendererLifecycleManager.instance.onReady(() => {
      void this.flushPendingTorrentOpens()
      void this.flushPendingOpenFilePayloads()
    })
  }

  processInitialArgv(argv: string[]): void {
    const initial = this.extractTorrentPathsFromArgv(argv)
    if (initial.length > 0) {
      this.pendingTorrentOpens.push(...initial)
    }
  }

  handleSecondInstance(argv: string[]): void {
    const files = this.extractTorrentPathsFromArgv(argv)
    if (files.length > 0) {
      void this.handleTorrentFileOpens(files)
    }
  }

  private extractTorrentPathsFromArgv(argv: string[]): string[] {
    const out: string[] = []
    for (const arg of argv ?? []) {
      if (typeof arg === 'string' && arg.toLowerCase().endsWith('.torrent')) {
        out.push(arg)
      }
    }
    return out
  }

  private async flushPendingTorrentOpens(): Promise<void> {
    if (this.pendingTorrentOpens.length === 0) return
    const paths = [...this.pendingTorrentOpens]
    this.pendingTorrentOpens = []
    await this.handleTorrentFileOpens(paths)
  }

  private async flushPendingOpenFilePayloads(): Promise<void> {
    if (this.pendingOpenFilePayloads.length === 0) return
    for (const payload of this.pendingOpenFilePayloads) {
      BridgeService.shared.broadcast('file:open-torrents', payload)
    }
    this.pendingOpenFilePayloads = []
  }

  async handleTorrentFileOpens(paths: string[]): Promise<void> {
    if (!paths || paths.length === 0) return
    // Ensure main window is visible
    await WindowManager.getInstance().showMainWindow()

    // Read files and broadcast to renderer
    const files: Array<{ name: string; data: Uint8Array; mime: string }> = []
    for (const p of paths) {
      try {
        const buf = await fs.readFile(p)
        files.push({
          name: basename(p),
          data: new Uint8Array(buf),
          mime: 'application/x-bittorrent',
        })
      } catch (e) {
        console.warn('Failed to read .torrent file:', p, e)
      }
    }
    if (files.length > 0) {
      const payload = { files }
      if (!RendererLifecycleManager.instance.isReady()) {
        this.pendingOpenFilePayloads.push(payload)
        return
      }
      BridgeService.shared.broadcast('file:open-torrents', payload)
    }
  }
}
