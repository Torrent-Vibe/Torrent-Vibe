import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

import type { AiProviderRuntime } from '../providers'
import { extractAssistantText } from '../text'

const textResult = (text: string): AgentToolResult<Record<string, never>> => ({
  content: [{ type: 'text', text }],
  details: {},
})

const webSearchSchema = Type.Object({
  query: Type.String(),
  language: Type.Optional(Type.String()),
  maxResults: Type.Optional(Type.Number()),
})

export function buildWebSearchTool(input: {
  resolveCodex: () => AiProviderRuntime | null
  sessionId: string
}): AgentTool<typeof webSearchSchema> {
  return {
    name: 'webSearch',
    label: 'Web Search',
    description:
      'Search the public web. Always uses the Codex provider, not the current chat model.',
    parameters: webSearchSchema,
    execute: async (_id, params) => {
      const runtime = input.resolveCodex()
      if (!runtime) {
        return textResult('webSearch unavailable: Codex is not configured')
      }

      const maxResults
        = typeof params.maxResults === 'number' && params.maxResults > 0
          ? Math.min(Math.floor(params.maxResults), 10)
          : 5
      const language = params.language?.trim() || 'en'

      const response = await runtime.models.completeSimple(
        runtime.model,
        {
          systemPrompt:
            'You are a web search tool. Return only JSON of the form {"results":[{"title":string,"url":string,"snippet":string}]}. No markdown.',
          messages: [
            {
              role: 'user',
              content: `Search the web in ${language}. Return up to ${maxResults} results for: ${params.query}`,
              timestamp: Date.now(),
            },
          ],
        },
        {
          ...(runtime.apiKey ? { apiKey: runtime.apiKey } : {}),
          sessionId: input.sessionId,
          reasoning: 'minimal',
          headers: { 'x-session-id': input.sessionId },
        },
      )

      const text = extractAssistantText([response])
      return textResult(text || '{"results":[]}')
    },
  }
}
