import { createModels } from '@earendil-works/pi-ai'
import { registerBunOAuthFlows } from '@earendil-works/pi-ai/bun-oauth'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'

import type { ProviderConfig } from '../types'
import {
  getCodexCredentialStore,
  hasCodexOAuthCredential,
} from './codex-credential-store'
import { DEFAULT_CODEX_MODEL } from './pi-runtime'
import type { AiProviderAdapter, AiProviderRuntime } from './types'

// tsdown flattens the main process; pi-ai's variable-specifier OAuth import then
// resolves to dist/main/openai-codex.js. This static hook embeds the flow.
registerBunOAuthFlows()

const ERROR_NAMESPACE = 'ai.codex'

export class CodexProviderAdapter implements AiProviderAdapter {
  readonly id = 'codex' as const
  readonly missingCredentialError = `${ERROR_NAMESPACE}.missingApiKey`

  isConfigured(_config: ProviderConfig): boolean {
    return hasCodexOAuthCredential()
  }

  resolve(config: ProviderConfig): AiProviderRuntime | null {
    if (!hasCodexOAuthCredential()) {
      return null
    }

    const modelId = config.providers.codex.model || DEFAULT_CODEX_MODEL
    const models = createModels({ credentials: getCodexCredentialStore() })
    models.setProvider(openaiCodexProvider())
    const model
      = models.getModel('openai-codex', modelId)
        ?? models.getModel('openai-codex', DEFAULT_CODEX_MODEL)
    if (!model) {
      return null
    }

    return {
      id: this.id,
      model,
      modelId: model.id,
      models,
      sessionAffinityFormat: 'openai',
      errorNamespace: ERROR_NAMESPACE,
    }
  }
}
