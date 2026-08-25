import { describe, expect, it } from 'vitest'

import { buildReadSkillTool } from './agentTools/skillTool'
import {
  loadAgentChatSkillIndex,
  readSkill,
  renderAvailableSkillsXml,
} from './skills'

describe('agent-chat skills', () => {
  it('indexes library-organize and read_skill returns the body', async () => {
    const index = loadAgentChatSkillIndex()
    expect(index.some((skill) => skill.name === 'library-organize')).toBe(true)
    const body = readSkill(index, 'library-organize')
    expect(body).toContain('audit_download_library')
    expect(body).toContain('hasMore')
    expect(body).toContain('tv-mikan:')
    const xml = renderAvailableSkillsXml(index)
    expect(xml).toContain('read_skill(name="library-organize")')
    const tool = buildReadSkillTool(index)
    const result = await tool.execute('c1', { name: 'library-organize' })
    const text = result.content[0]
    expect(
      text?.type === 'text' && text.text.includes('Generic queue organization'),
    ).toBe(true)
    const missing = await tool.execute('c2', { name: 'nope' })
    const missingText = missing.content[0]
    expect(missingText?.type === 'text' && missingText.text).toBe(
      'unknown skill: nope',
    )
  })
})
