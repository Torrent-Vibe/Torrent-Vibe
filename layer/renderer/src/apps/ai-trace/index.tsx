import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { ResponsiveSelect } from '~/components/ui/select/ResponsiveSelect'
import { useBridgeEvent } from '~/hooks/common/useBridgeEvent'
import { TorrentAiTraceActions } from '~/modules/torrent-ai-trace'
import { TorrentAiTraceChart } from '~/modules/torrent-ai-trace/components/TorrentAiTraceChart'
import { useTorrentAiTraceStore } from '~/modules/torrent-ai-trace/store'

export const TorrentAiTraceApp = () => {
  const { t } = useTranslation()
  const selectedRunId = useTorrentAiTraceStore((state) => state.selectedRunId)
  const runOrder = useTorrentAiTraceStore((state) => state.runOrder)
  const runs = useTorrentAiTraceStore((state) => state.runs)
  const selected = selectedRunId ? runs[selectedRunId] : undefined
  const runItems = useMemo(
    () =>
      runOrder.flatMap((id) => {
        const run = runs[id]
        if (!run) {
          return []
        }
        return [
          {
            value: id,
            label: `${run.rawName || id} · ${run.provider}/${run.model}`,
          },
        ]
      }),
    [runOrder, runs],
  )

  useEffect(() => {
    void TorrentAiTraceActions.shared.configure()
  }, [])

  useBridgeEvent('torrent-ai:trace', (event) => {
    TorrentAiTraceActions.shared.ingest(event)
  })

  return (
    <div className="flex h-screen flex-col bg-background text-text">
      <header className="drag-region flex shrink-0 items-center gap-2 border-b border-border px-4 pt-10 pb-3">
        <p className="no-drag-region text-sm font-medium">
          {t('torrent.ai.trace.title')}
        </p>
        <div className="no-drag-region min-w-0 flex-1">
          <ResponsiveSelect
            items={runItems}
            placeholder={t('torrent.ai.trace.selectRun')}
            size="sm"
            triggerClassName="bg-material-medium"
            value={selectedRunId ?? ''}
            onValueChange={(value) => {
              TorrentAiTraceActions.shared.selectRun(value || null)
            }}
          />
        </div>
        <Button
          disabled={!selected}
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (!selected) {
              return
            }
            const result = await TorrentAiTraceActions.shared.exportRun(
              selected.runId,
            )
            if (result.ok) {
              toast.success(t('torrent.ai.trace.exportSaved'))
              return
            }
            if (result.error === 'canceled') {
              return
            }
            toast.error(t('torrent.ai.trace.exportFailed'))
          }}
        >
          {t('torrent.ai.trace.export')}
        </Button>
      </header>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-4">
        {selected ? (
          <TorrentAiTraceChart run={selected} />
        ) : (
          <p className="py-16 text-center text-sm text-text-tertiary">
            {t('torrent.ai.trace.empty')}
          </p>
        )}
      </main>
      {selected ? (
        <footer className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-text-secondary">
          {t('torrent.ai.trace.cacheSummary', {
            broke: selected.events.filter(
              (event) => event.type === 'cache_broke',
            ).length,
            total: new Set(
              selected.events
                .filter((event) => event.type === 'call_compiled')
                .map((event) =>
                  event.type === 'call_compiled' ? event.callIndex : null,
                ),
            ).size,
          })}
        </footer>
      ) : null}
    </div>
  )
}
