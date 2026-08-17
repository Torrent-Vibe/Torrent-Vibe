import type { TelemetryCacheHint } from '@innei/message-engine/devtools'
import { MessageEngineDevtools } from '@innei/message-engine/devtools/react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useBridgeEvent } from '~/hooks/common/useBridgeEvent'
import { useThemeAtomValue } from '~/hooks/common/useDark'
import { TorrentAiTraceActions } from '~/modules/torrent-ai-trace'
import { torrentAiTraceDevtoolsSource } from '~/modules/torrent-ai-trace/devtools-source'
import { useTorrentAiTraceStore } from '~/modules/torrent-ai-trace/store'

const HINT_KEYS: Record<TelemetryCacheHint['kind'], I18nKeys> = {
  'below-floor': 'torrent.ai.trace.hintBelowFloor',
  'missed-after-prefix': 'torrent.ai.trace.hintMissedAfterPrefix',
  'near-floor': 'torrent.ai.trace.hintNearFloor',
  'page-remainder': 'torrent.ai.trace.hintPageRemainder',
}

const formatTokens = (value: number): string => {
  if (value < 1000) {
    return String(value)
  }
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`
}

export const TorrentAiTraceApp = () => {
  const { t } = useTranslation()
  const theme = useThemeAtomValue()
  const selectedSessionId = useTorrentAiTraceStore((state) => {
    if (!state.selectedRunId) {
      return undefined
    }
    return state.runs[state.selectedRunId]?.sessionId
  })
  const labels = useMemo(
    () => ({
      activities: t('torrent.ai.trace.activities'),
      anatomy: t('torrent.ai.trace.prompt'),
      cache: t('torrent.ai.trace.cache'),
      calls: t('torrent.ai.trace.calls'),
      emptyDescription: t('torrent.ai.trace.emptyDescription'),
      emptyTitle: t('torrent.ai.trace.empty'),
      export: t('torrent.ai.trace.export'),
      input: t('torrent.ai.trace.input'),
      output: t('torrent.ai.trace.output'),
      overview: t('torrent.ai.trace.overview'),
      prompt: t('torrent.ai.trace.prompt'),
      raw: t('torrent.ai.trace.raw'),
      runs: t('torrent.ai.trace.runs'),
      searchRuns: t('torrent.ai.trace.searchRuns'),
      selectRun: t('torrent.ai.trace.selectRun'),
      timeline: t('torrent.ai.trace.timeline'),
      title: 'Message Engine',
    }),
    [t],
  )

  useEffect(() => {
    void TorrentAiTraceActions.shared.configure()
  }, [])

  useBridgeEvent('torrent-ai:trace', (event) => {
    TorrentAiTraceActions.shared.ingest(event)
  })

  return (
    <div className="relative h-screen overflow-hidden bg-background macos:pt-8">
      <div
        aria-hidden
        className="drag-region absolute inset-x-0 top-0 z-20 hidden h-8 macos:block"
      />
      <MessageEngineDevtools
        cachePolicy={{ minimumCacheTokens: 1024 }}
        className="torrent-ai-devtools"
        labels={labels}
        selectedRunId={selectedSessionId}
        source={torrentAiTraceDevtoolsSource}
        theme={theme}
        formatCacheHint={(hint) =>
          t(HINT_KEYS[hint.kind], { tokens: formatTokens(hint.tokens) })
        }
        onExport={(run) => {
          void TorrentAiTraceActions.shared
            .exportSession(run.sessionId)
            .then((result) => {
              if (result.ok) {
                toast.success(t('torrent.ai.trace.exportSaved'))
                return
              }
              if (result.error === 'canceled') {
                return
              }
              toast.error(t('torrent.ai.trace.exportFailed'))
            })
        }}
        onSelectedRunChange={(sessionId) => {
          TorrentAiTraceActions.shared.selectSession(sessionId)
        }}
      />
    </div>
  )
}
