import type { AgentChatMessageMetadata } from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'

import { formatCost, formatDuration } from './format'

export const MessageMetadataBar = ({
  metadata,
}: {
  metadata: AgentChatMessageMetadata
}) => {
  const { t } = useTranslation()
  const tps = metadata.tokensPerSecond?.toFixed(1) ?? '—'
  const cost = formatCost(metadata.usage.costUsd)
  const detail = [
    `${t('agent.metadata.model')}: ${metadata.provider} / ${metadata.model}`,
    `${t('agent.metadata.duration')}: ${formatDuration(metadata.durationMs)}`,
    `${t('agent.metadata.ttft')}: ${formatDuration(metadata.ttftMs)}`,
    `${t('agent.metadata.tokens')}: ${metadata.usage.totalTokens}`,
    `${t('agent.metadata.input')}: ${metadata.usage.inputTokens}`,
    `${t('agent.metadata.output')}: ${metadata.usage.outputTokens}`,
    `${t('agent.metadata.cache')}: ${metadata.usage.cacheReadTokens + metadata.usage.cacheWriteTokens}`,
    `${t('agent.metadata.reasoning')}: ${metadata.usage.reasoningTokens}`,
    `${t('agent.metadata.cost')}: ${cost}`,
  ].join('\n')

  return (
    <p
      aria-label={detail}
      className="mt-1 text-[10px] text-text-quaternary"
      title={detail}
    >
      {formatDuration(metadata.durationMs)}
      {import.meta.env.DEV ? ` · ${tps} tok/s · ${cost}` : null}
    </p>
  )
}
