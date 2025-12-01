import type { TorrentAIEnrichmentResult } from '@torrent-vibe/shared'
import type { IpcContext } from 'electron-ipc-decorator'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { TorrentAiEngine } from '../services/torrent-ai'
import type { AnalyzeTorrentNameOptions } from '../services/torrent-ai/types'

// Keep a local alias for backward compatibility in generated d.ts
type AnalyzeNamePayload = AnalyzeTorrentNameOptions

export class TorrentAiIPCService extends IpcService {
  static override readonly groupName = 'torrentAi'

  private get engine() {
    return TorrentAiEngine.getInstance()
  }

  @IpcMethod()
  async analyzeName(
    _context: IpcContext,
    payload: AnalyzeNamePayload,
  ): Promise<TorrentAIEnrichmentResult> {
    const normalized = payload?.rawName?.trim()
    if (!normalized) {
      return { ok: false, error: 'ai.invalidRawName', transient: false }
    }

    return this.engine.analyzeName({
      rawName: normalized,
      hash: payload.hash,
      forceRefresh: payload.forceRefresh,
      fileList: payload.fileList,
    })
  }

  @IpcMethod()
  isAvailable(_context: IpcContext): boolean {
    return this.engine.hasConfiguredProvider()
  }

  @IpcMethod()
  async clearCache() {
    await this.engine.clearCache()
  }
}
