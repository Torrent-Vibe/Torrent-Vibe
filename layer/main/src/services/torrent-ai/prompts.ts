import { i18n } from '~/utils/i18n'

import SYSTEM_PROMPT_TEMPLATE from './SYSTEM_ANALYZE_PROMPT.md?raw'

const USER_PROMPT_TEMPLATE = [
  'INPUT:',
  `- Torrent release name: {{rawName}}`,
  '- File tree summary:',
  '{{fileTreeSummary}}',
].join('\n')

export const renderSystemPrompt = (): string =>
  SYSTEM_PROMPT_TEMPLATE.replaceAll('{{language}}', i18n.language)

export const renderUserPrompt = (
  rawName: string,
  fileTreeSummary?: string | null,
): string =>
  USER_PROMPT_TEMPLATE.replaceAll('{{rawName}}', rawName)
    .replace('{{fileTreeSummary}}', fileTreeSummary || 'N/A')
    .replaceAll('{{language}}', i18n.language)
