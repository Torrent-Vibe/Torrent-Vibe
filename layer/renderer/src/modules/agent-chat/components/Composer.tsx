import type { AgentChatContext } from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button/Button'
import { Textarea } from '~/components/ui/input/Textarea'

import { AgentChatActions } from '../actions'
import { useAgentChatStore } from '../store'
import { AgentContextChips } from './ContextChips'

const hasComposerContext = (
  context: AgentChatContext,
  multiServer: boolean,
) => {
  const filter = context.filter
  return (
    (multiServer && !context.activeServerId) ||
    context.selectedTorrentHashes.length > 0 ||
    Boolean(filter?.search) ||
    (filter?.categories?.length ?? 0) > 0 ||
    (filter?.statuses?.length ?? 0) > 0 ||
    (filter?.tags?.length ?? 0) > 0
  )
}

const actions = AgentChatActions.shared

export const Composer = ({
  composerContext,
  multiServer,
}: {
  composerContext: AgentChatContext
  multiServer: boolean
}) => {
  const { t, i18n } = useTranslation()
  const draft = useAgentChatStore((state) => state.draft)
  const error = useAgentChatStore((state) => state.error)
  const isDemo = useAgentChatStore((state) => state.isDemo)
  const isRunning = useAgentChatStore((state) => state.isRunning)
  const showComposerContext = hasComposerContext(composerContext, multiServer)
  const displayError = error
    ? i18n.exists(error)
      ? String(i18n.t(error as never))
      : error
    : null

  return (
    <div className="shrink-0 border-t border-border bg-background p-3">
      {displayError && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red/20 bg-red/5 px-2.5 py-2 text-xs text-red">
          <i className="i-mingcute-warning-line mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{displayError}</span>
        </div>
      )}
      {showComposerContext ? (
        <div className="min-w-0 overflow-x-auto pb-1.5">
          <AgentContextChips
            context={composerContext}
            label={t('agent.context.draftScope')}
            multiServer={multiServer}
            removable={!isDemo}
            variant="composer"
          />
        </div>
      ) : null}
      <Textarea
        data-agent-composer
        aria-label={t('agent.composer.placeholder')}
        className="max-h-32 min-h-[68px] resize-none rounded-none border-0 bg-transparent px-0 py-1.5 shadow-none focus:ring-0 disabled:bg-transparent"
        disabled={isRunning || isDemo}
        value={draft}
        placeholder={
          isDemo ? t('agent.demo.readOnly') : t('agent.composer.placeholder')
        }
        onChange={(event) => actions.setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void actions.send()
          }
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-quaternary">
          {isDemo ? t('agent.demo.readOnly') : t('agent.composer.hint')}
        </span>
        {isRunning ? (
          <Button
            className="size-8 rounded-lg p-0"
            title={t('agent.stop')}
            variant="secondary"
            onClick={() => actions.cancel()}
          >
            <i className="i-mingcute-stop-fill" />
          </Button>
        ) : (
          <Button
            className="size-8 rounded-lg p-0"
            disabled={isDemo || !draft.trim()}
            title={t('agent.send')}
            onClick={() => void actions.send()}
          >
            <i className="i-mingcute-arrow-up-line text-base" />
          </Button>
        )}
      </div>
    </div>
  )
}
