import { useTranslation } from 'react-i18next'

import { useTorrentStats } from '~/modules/torrent/hooks/use-torrent-computed'

import { AgentChatActions } from '../actions'

const actions = AgentChatActions.shared

export const EmptyState = ({ selectedCount }: { selectedCount: number }) => {
  const { t } = useTranslation()
  const stats = useTorrentStats()
  const queueFacts = (
    [
      ['downloading', stats.downloading],
      ['seeding', stats.seeding],
      ['paused', stats.paused],
      ['error', stats.error],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} ${t(`torrent.filters.${key}`)}`)
    .join(' · ')
  const suggestions = [
    selectedCount > 0
      ? t('agent.suggestion.inspectSelected', { count: selectedCount })
      : t('agent.suggestion.summarizeQueue'),
    t('agent.suggestion.findStalled'),
    selectedCount > 0
      ? t('agent.suggestion.organizeSelected')
      : t('agent.suggestion.organizeCompleted'),
  ]

  return (
    <div className="flex min-h-full flex-col justify-center px-5 py-8">
      <div className="mb-6">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-fill-secondary text-accent">
          <i className="i-mingcute-brain-line text-xl" />
        </div>
        <h3 className="text-base font-semibold text-text">
          {t('agent.empty.title')}
        </h3>
        <p className="mt-1 max-w-sm text-sm leading-5 text-text-secondary">
          {queueFacts || t('agent.empty.description')}
        </p>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-fill-secondary hover:text-text"
            key={suggestion}
            type="button"
            onClick={() => void actions.send(suggestion)}
          >
            <i
              className={
                index === 0
                  ? 'i-mingcute-list-check-3-line text-accent'
                  : index === 1
                    ? 'i-mingcute-search-2-line text-orange'
                    : 'i-mingcute-flash-line text-green'
              }
            />
            <span className="flex-1">{suggestion}</span>
            <i className="i-mingcute-arrow-right-line text-text-quaternary transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  )
}
