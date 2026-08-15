import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

import type { SkillMeta } from '../skills'
import { readSkill } from '../skills'

const readSkillSchema = Type.Object({ name: Type.String() })

const textResult = (text: string): AgentToolResult<Record<string, never>> => ({
  content: [{ type: 'text', text }],
  details: {},
})

export function buildReadSkillTool(
  skillIndex: SkillMeta[],
): AgentTool<typeof readSkillSchema> {
  return {
    name: 'read_skill',
    label: 'Read Skill',
    description: 'Load the full SKILL.md text for a named skill.',
    parameters: readSkillSchema,
    execute: async (_id, params) =>
      textResult(
        readSkill(skillIndex, params.name) ?? `unknown skill: ${params.name}`,
      ),
  }
}
