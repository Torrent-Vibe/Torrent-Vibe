import { describe, expect, it } from 'vitest'

import { desiredStateDiff } from './desired-state'
import type { HelperReplica } from './types'

function replica(
  partial: Pick<HelperReplica, 'id'> & Partial<HelperReplica>,
): HelperReplica {
  return {
    bangumiId: 'bgm-1',
    title: 'Title',
    subgroupId: 'sg-1',
    subgroupName: 'Subgroup',
    rssUrl: 'https://example.com/rss',
    ...partial,
  }
}

const A = replica({ id: 'A', rssUrl: 'https://example.com/a' })
const APrime = replica({ id: 'A', rssUrl: 'https://example.com/a-prime' })
const B = replica({ id: 'B', rssUrl: 'https://example.com/b' })
const C = replica({ id: 'C', rssUrl: 'https://example.com/c' })

describe('desiredStateDiff', () => {
  it('returns empty ops when desired and current are empty', () => {
    expect(desiredStateDiff([], [])).toEqual([])
  })

  it('adds when desired has A and current is empty', () => {
    expect(desiredStateDiff([A], [])).toEqual([{ type: 'add', replica: A }])
  })

  it('removes when desired is empty and current has A', () => {
    expect(desiredStateDiff([], [A])).toEqual([{ type: 'remove', id: 'A' }])
  })

  it('adds only missing B when desired is A+B and current is A', () => {
    expect(desiredStateDiff([A, B], [A])).toEqual([{ type: 'add', replica: B }])
  })

  it('removes then adds when same id has different fields', () => {
    expect(desiredStateDiff([APrime], [A])).toEqual([
      { type: 'remove', id: 'A' },
      { type: 'add', replica: APrime },
    ])
  })

  it('removes extra C while keeping A and B', () => {
    expect(desiredStateDiff([A, B], [A, B, C])).toEqual([
      { type: 'remove', id: 'C' },
    ])
  })
})
