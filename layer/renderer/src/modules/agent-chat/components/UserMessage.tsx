import { useTranslation } from 'react-i18next'

import type { AgentChatUiMessage } from '../types'
import { AgentContextChips } from './ContextChips'

export const UserMessage = ({ message }: { message: AgentChatUiMessage }) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-end gap-1.5">
      <p className="max-w-[88%] text-right text-sm leading-6 text-text">
        {message.content}
      </p>
      {message.context ? (
        <div className="max-w-full opacity-70">
          <AgentContextChips
            context={message.context}
            label={t('agent.context.messageScope')}
          />
        </div>
      ) : null}
    </div>
  )
}
