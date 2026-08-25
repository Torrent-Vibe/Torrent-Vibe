import { describe, expect, it } from 'vitest'

import { hasUngroundedPlanClaim } from './plan-grounding'

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
