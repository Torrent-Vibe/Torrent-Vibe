import type { AgentMessage } from '@earendil-works/pi-agent-core'

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
