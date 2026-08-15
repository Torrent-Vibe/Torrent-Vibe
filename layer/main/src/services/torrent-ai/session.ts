import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core'
import { Agent } from '@earendil-works/pi-agent-core'
import {
  BaseLastUserContentProvider,
  BaseSystemPromptProvider,
} from '@innei/message-engine'
import {
  createPiMessageEngine,
  createPiSystemPromptBridge,
} from '@innei/message-engine/adapters/pi'

import { renderSystemPrompt } from './prompts'
import type { AiProviderRuntime } from './providers'
import { openRouterAppHeaders } from './providers/openrouter-provider'
import { loadSkillIndex, renderAvailableSkillsXml } from './skills'
import { extractAssistantText } from './text'

class AnalysisSystemPromptProvider extends BaseSystemPromptProvider {
  readonly id = 'torrent-ai.system'
  constructor(private readonly prompt: string) {
    super({ cacheScope: 'session' })
  }

  protected build(): string {
    return this.prompt
  }
}

class SkillCatalogProvider extends BaseLastUserContentProvider {
  readonly id = 'torrent-ai.skill-catalog'
  constructor(private readonly catalog: string) {
    super({ cacheScope: 'turn' })
  }

  protected build(): string | null {
    return this.catalog || null
  }
}

class FileTreeProvider extends BaseLastUserContentProvider {
  readonly id = 'torrent-ai.file-tree'
  constructor(private readonly summary: string | null) {
    super({ cacheScope: 'turn' })
  }

  protected build(): string | null {
    return this.summary
  }
}

export async function runAnalysisAgent(input: {
  runtime: AiProviderRuntime
  userPrompt: string
  fileTreeSummary?: string | null
  tools: AgentTool[]
  sessionId: string
}): Promise<{ text: string, errorMessage?: string }> {
  const skillIndex = loadSkillIndex()
  const catalog = renderAvailableSkillsXml(skillIndex)
  const systemPrompt = [
    renderSystemPrompt(),
    'available_skills is the project capability catalog; each description says when to use it. Load a full skill with read_skill when needed.',
    'The last assistant message must be a single JSON object matching the required schema. No markdown or code fences.',
  ].join('\n\n')

  const engine = createPiMessageEngine({
    initial: { agentId: 'torrent-ai' },
    services: {},
    sessionId: input.sessionId,
    strict: true,
    baseSystemPrompt: systemPrompt,
    modules: [
      {
        id: 'torrent-ai',
        processors: [
          new AnalysisSystemPromptProvider(systemPrompt),
          new SkillCatalogProvider(catalog),
          new FileTreeProvider(input.fileTreeSummary ?? null),
        ],
      },
    ],
  })

  const systemPromptBridge = createPiSystemPromptBridge(systemPrompt)
  let turns = 0

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model: input.runtime.model,
      thinkingLevel: 'minimal',
      tools: input.tools,
      messages: [],
    },
    sessionId: input.sessionId,
    toolExecution: 'parallel',
    streamFn: (model, context, options) =>
      input.runtime.models.streamSimple(
        model,
        systemPromptBridge.apply(context),
        {
          ...options,
          ...(input.runtime.apiKey ? { apiKey: input.runtime.apiKey } : {}),
          sessionId: input.sessionId,
          reasoning: 'minimal',
          headers: {
            ...(input.runtime.id === 'openrouter'
              ? openRouterAppHeaders()
              : {}),
            'x-session-id': input.sessionId,
          },
        },
      ),
    transformContext: engine.createTransformContext({
      step: () => ({ iteration: ++turns }),
      onCompiled: (result) => {
        systemPromptBridge.capture(result)
      },
    }),
    shouldStopAfterTurn: () => turns >= 50,
  })

  try {
    await agent.prompt(input.userPrompt)
    const messages = agent.state.messages as AgentMessage[]
    return {
      text: extractAssistantText(messages),
      errorMessage: agent.state.errorMessage,
    }
  }
  finally {
    await engine.destroy()
  }
}
