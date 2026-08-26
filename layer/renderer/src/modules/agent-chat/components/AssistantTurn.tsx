import { useTranslation } from 'react-i18next'

import { MessageResponse } from '~/components/ai-elements/message'
import { Reasoning } from '~/components/ai-elements/reasoning'

import type { AgentChatUiMessage } from '../types'
import { MessageMetadataBar } from './MessageMetadataBar'
import { PlanCard } from './PlanCard'
import { ToolActivity } from './ToolActivity'

export const AssistantTurn = ({ message }: { message: AgentChatUiMessage }) => {
  const { t } = useTranslation()
  const isStreaming = message.status === 'streaming'
  const pendingPlans = message.plans.filter(
    (plan) => plan.status === 'pending' || plan.status === 'executing',
  )
  const settledPlans = message.plans.filter(
    (plan) => plan.status !== 'pending' && plan.status !== 'executing',
  )

  return (
    <div className="min-w-0 space-y-4">
      {message.activities.length > 0 && (
        <div className="min-w-0 space-y-3">
          {message.activities.map((activity) => (
            <ToolActivity activity={activity} key={activity.id} />
          ))}
        </div>
      )}
      {message.reasoning && (
        <Reasoning isStreaming={isStreaming} label={t('agent.reasoning')}>
          {message.reasoning}
        </Reasoning>
      )}
      {message.content ? (
        <MessageResponse isAnimating={isStreaming}>
          {message.content}
        </MessageResponse>
      ) : (
        isStreaming && (
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <i className="i-mingcute-loading-3-line animate-spin" />
            <span>{t('agent.thinking')}</span>
          </div>
        )
      )}
      {pendingPlans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
      {settledPlans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
      {message.metadata && <MessageMetadataBar metadata={message.metadata} />}
    </div>
  )
}
