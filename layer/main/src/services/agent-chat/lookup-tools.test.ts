import { describe, expect, it, vi } from 'vitest'

import { buildAgentChatLookupTools } from './lookup-tools'

vi.mock('../app-settings-store', () => ({
  AppSettingsStore: {
    getInstance: () => ({ getSearchProvider: () => 'none' }),
  },
}))

vi.mock('../torrent-ai/provider-config', () => ({
  resolveAiProviderConfig: () => ({ tmdbApiKey: null }),
}))

vi.mock('../torrent-ai/providers', () => ({
  getProviderById: () => null,
}))

vi.mock('../torrent-ai/tmdb-client', () => ({
  TmdbClient: class {
    setApiKey() {}
    isConfigured() {
      return false
    }
  },
}))

vi.mock('../torrent-ai/agentTools/bashTool', () => ({
  buildBashTool: () => ({
    name: 'bash',
    label: 'Bash',
    description: 'bash',
    parameters: {},
    execute: async () => ({ content: [] }),
  }),
}))

vi.mock('../torrent-ai/agentTools/tmdbTools', () => ({
  buildTmdbTools: () => [],
}))

vi.mock('../torrent-ai/agentTools/webSearchTool', () => ({
  buildWebSearchTool: () => ({
    name: 'webSearch',
    label: 'Web Search',
    description: 'search',
    parameters: {},
    execute: async () => ({ content: [] }),
  }),
}))

describe('agent-chat lookup tools', () => {
  it('always includes restricted bash', () => {
    const tools = buildAgentChatLookupTools('session-a')
    expect(tools.map((tool) => tool.name)).toEqual(['bash'])
  })
})
