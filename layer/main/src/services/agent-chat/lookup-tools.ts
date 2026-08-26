import type { AgentTool } from '@earendil-works/pi-agent-core'

import { AppSettingsStore } from '../app-settings-store'
import { buildBashTool } from '../torrent-ai/agentTools/bashTool'
import { buildTmdbTools } from '../torrent-ai/agentTools/tmdbTools'
import { buildWebSearchTool } from '../torrent-ai/agentTools/webSearchTool'
import { resolveAiProviderConfig } from '../torrent-ai/provider-config'
import { getProviderById } from '../torrent-ai/providers'
import { TmdbClient } from '../torrent-ai/tmdb-client'

const tmdbClient = new TmdbClient()

export const buildAgentChatLookupTools = (sessionId: string): AgentTool[] => {
  const tools: AgentTool[] = [buildBashTool()]
  const config = resolveAiProviderConfig()
  tmdbClient.setApiKey(config.tmdbApiKey)
  if (tmdbClient.isConfigured()) {
    tools.push(...buildTmdbTools(tmdbClient))
  }

  if (AppSettingsStore.getInstance().getSearchProvider() === 'codex') {
    const resolveCodex = () =>
      getProviderById('codex')?.resolve(resolveAiProviderConfig()) ?? null
    if (resolveCodex()) {
      tools.push(buildWebSearchTool({ resolveCodex, sessionId }))
    }
  }

  return tools
}
