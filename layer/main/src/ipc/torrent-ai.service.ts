import type { TorrentAIEnrichmentResult } from '@torrent-vibe/shared'
import { IpcMethod, IpcService } from 'electron-ipc-decorator'

import { TorrentAiEngine } from '../services/torrent-ai'
import { getAiTraceSink } from '../services/torrent-ai/trace'
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
  async lookupCached(payload: {
    rawName: string
    hash?: string
  }): Promise<TorrentAIEnrichmentResult> {
    const normalized = payload?.rawName?.trim()
    if (!normalized) {
      return { ok: false, error: 'ai.invalidRawName', transient: false }
    }

    return this.engine.lookupCached({
      rawName: normalized,
      hash: payload.hash,
    })
  }

  @IpcMethod()
  isAvailable(): boolean {
    return this.engine.hasConfiguredProvider()
  }

  @IpcMethod()
  async clearCache() {
    await this.engine.clearCache()
  }

  @IpcMethod()
  getTraceSnapshot() {
    return getAiTraceSink().getSnapshot()
  }

  @IpcMethod()
  getTraceExport(payload: { runId: string }) {
    const runId = payload?.runId?.trim()
    if (!runId) {
      return null
    }
    return getAiTraceSink().getExport(runId)
  }
}
