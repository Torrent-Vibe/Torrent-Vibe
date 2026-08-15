import type { AgentMessage } from '@earendil-works/pi-agent-core'

import { SUBMIT_METADATA_TOOL_NAME } from './agentTools/submitMetadataTool'

export function extractAssistantText(
  messages: readonly AgentMessage[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.role !== 'assistant') {
      continue
    }
    if (!Array.isArray(message.content)) {
      continue
    }
    const text = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()
    if (text) {
      return text
    }
  }
  return ''
}

export function extractSubmitMetadataArguments(
  messages: readonly AgentMessage[],
): unknown | null {
  let fallback: unknown = null
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (
      message.role === 'toolResult'
      && message.toolName === SUBMIT_METADATA_TOOL_NAME
    ) {
      const details = message.details as { payload?: unknown } | undefined
      if (!message.isError && details?.payload != null) {
        return details.payload
      }
      continue
    }
    if (message.role !== 'assistant' || !Array.isArray(message.content)) {
      continue
    }
    for (let j = message.content.length - 1; j >= 0; j--) {
      const block = message.content[j]
      if (
        block.type !== 'toolCall'
        || block.name !== SUBMIT_METADATA_TOOL_NAME
      ) {
        continue
      }
      fallback ??= block.arguments
    }
  }
  return fallback
}

export function hasSuccessfulSubmitMetadata(
  toolResults: readonly { toolName?: string, isError?: boolean }[],
): boolean {
  return toolResults.some(
    result =>
      result.toolName === SUBMIT_METADATA_TOOL_NAME && !result.isError,
  )
}
