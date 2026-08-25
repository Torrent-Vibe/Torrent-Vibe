import { describe, expect, it } from 'vitest'

import { hasUngroundedPlanClaim } from './plan-grounding'
import { renderSystemPrompt } from './system-prompt'

describe('agent plan grounding', () => {
  it('rejects invented ready plans without hiding real or failed plans', () => {
    const claim =
      '已创建移动计划，计划 ID e3e96f0b-461f-4cdc-9f76-3ad29f8bd88b，请在界面中确认。'

    expect(hasUngroundedPlanClaim(claim, 0)).toBe(true)
    expect(hasUngroundedPlanClaim(claim, 1)).toBe(false)
    expect(
      hasUngroundedPlanClaim(
        'Plan e3e96f0b-461f-4cdc-9f76-3ad29f8bd88b was not created.',
        0,
      ),
    ).toBe(false)
  })
})

describe('renderSystemPrompt', () => {
  it('teaches audit-first organize and bulk rename', () => {
    const prompt = renderSystemPrompt({
      context: {
        activeServerId: 'server-a',
        activeServerName: 'Primary',
        locale: 'en',
        selectedTorrentHashes: [],
        visibleTorrentCount: 0,
      },
      history: [],
      message: 'organize my library',
      runId: 'run-1',
      sessionId: 'session-1',
    })

    expect(prompt).toContain('audit_download_library')
    expect(prompt).toContain('read_skill')
    expect(prompt).toContain('read_skill("library-organize")')
    expect(prompt).toContain('renames: [{ hash, newName }]')
    expect(prompt).not.toContain('Rename exactly one torrent at a time')
    expect(prompt).not.toContain(
      'For organization requests, first use preview_download_organization',
    )
  })
})
