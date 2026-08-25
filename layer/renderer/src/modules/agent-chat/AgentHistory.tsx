import { useTranslation } from 'react-i18next'

import { Button } from '~/components/ui/button/Button'

import { AgentChatActions } from './actions'
import { useAgentChatStore } from './store'

const actions = AgentChatActions.shared

export const AgentHistory = () => {
  const { t, i18n } = useTranslation()
  const conversations = useAgentChatStore((state) => state.conversations)
  const historyLoading = useAgentChatStore((state) => state.historyLoading)
  const sessionId = useAgentChatStore((state) => state.sessionId)
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-text">
            {t('agent.history.title')}
          </h3>
          <p className="text-[11px] text-text-tertiary">
            {t('agent.history.count', { count: conversations.length })}
          </p>
        </div>
        <Button
          aria-label={t('buttons.close')}
          className="!p-2"
          title={t('buttons.close')}
          variant="ghost"
          onClick={() => actions.closeHistory()}
        >
          <i className="i-mingcute-close-line text-lg" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {historyLoading ? (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <i className="i-mingcute-loading-3-line animate-spin text-lg" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <i className="i-mingcute-history-line text-2xl text-text-quaternary" />
            <p className="text-sm text-text-secondary">
              {t('agent.history.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group flex w-full items-center rounded-lg border transition-colors ${
                  conversation.id === sessionId
                    ? 'border-accent/25 bg-accent/8'
                    : 'border-transparent hover:bg-fill-secondary'
                }`}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                  type="button"
                  onClick={() => void actions.loadConversation(conversation.id)}
                >
                  <i className="i-mingcute-chat-3-line shrink-0 text-text-tertiary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">
                      {conversation.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-text-tertiary">
                      {dateFormatter.format(conversation.updatedAt)} ·{' '}
                      {t('agent.history.messages', {
                        count: conversation.messageCount,
                      })}
                    </span>
                  </span>
                </button>
                <Button
                  aria-label={t('agent.history.delete')}
                  className="shrink-0 !border-0 !p-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title={t('agent.history.delete')}
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation()
                    void actions.deleteConversation(conversation.id)
                  }}
                >
                  <i className="i-mingcute-delete-2-line text-red" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
