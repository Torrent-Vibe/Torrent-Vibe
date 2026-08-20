import { describe, expect, it } from 'vitest'

import {
  resolveHeaderActionMenuItems,
  resolveHeaderActionMode,
} from './header-actions-model'

describe('resolveHeaderActionMode', () => {
  it('is manage whenever subscribed, regardless of paired or hasSubgroups', () => {
    for (const paired of [true, false]) {
      for (const hasSubgroups of [true, false]) {
        expect(
          resolveHeaderActionMode({ paired, subscribed: true, hasSubgroups }),
        ).toEqual({ type: 'manage' })
      }
    }
  })

  it('opens pairing when unsubscribed and no helper is paired, regardless of hasSubgroups', () => {
    for (const hasSubgroups of [true, false]) {
      expect(
        resolveHeaderActionMode({
          paired: false,
          subscribed: false,
          hasSubgroups,
        }),
      ).toEqual({ type: 'subscribe', trigger: 'openPairing' })
    }
  })

  it('flags noSubgroups when paired, unsubscribed, and the bangumi has no subgroups', () => {
    expect(
      resolveHeaderActionMode({
        paired: true,
        subscribed: false,
        hasSubgroups: false,
      }),
    ).toEqual({ type: 'subscribe', trigger: 'noSubgroups' })
  })

  it('allows subscribing when paired, unsubscribed, and a subgroup exists', () => {
    expect(
      resolveHeaderActionMode({
        paired: true,
        subscribed: false,
        hasSubgroups: true,
      }),
    ).toEqual({ type: 'subscribe', trigger: 'subscribe' })
  })

  it('never yields a mode that would justify disabling the button', () => {
    const validTypes = new Set(['manage', 'subscribe'])
    for (const paired of [true, false]) {
      for (const subscribed of [true, false]) {
        for (const hasSubgroups of [true, false]) {
          const mode = resolveHeaderActionMode({
            paired,
            subscribed,
            hasSubgroups,
          })
          expect(validTypes.has(mode.type)).toBe(true)
        }
      }
    }
  })
})

describe('resolveHeaderActionMenuItems', () => {
  it('omits checkNow when no target server supports the check capability', () => {
    expect(
      resolveHeaderActionMenuItems({
        targetServerIds: ['srv-a', 'srv-b'],
        checkSupportByServerId: { 'srv-a': false, 'srv-b': false },
      }),
    ).toEqual(['editTargets', 'unsubscribe'])
  })

  it('includes checkNow when at least one target server supports check', () => {
    expect(
      resolveHeaderActionMenuItems({
        targetServerIds: ['srv-a', 'srv-b'],
        checkSupportByServerId: { 'srv-a': false, 'srv-b': true },
      }),
    ).toEqual(['editTargets', 'checkNow', 'unsubscribe'])
  })

  it('omits checkNow when there are no target servers at all', () => {
    expect(
      resolveHeaderActionMenuItems({
        targetServerIds: [],
        checkSupportByServerId: {},
      }),
    ).toEqual(['editTargets', 'unsubscribe'])
  })
})
