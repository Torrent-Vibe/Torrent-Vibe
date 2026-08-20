import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getHelperStatus } from './api'

const jsonResponse = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )

describe('getHelperStatus backward compatibility', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const replicaFixture = {
    id: 'r1',
    bangumiId: 'b1',
    title: 'Show',
    subgroupId: 'sg1',
    subgroupName: 'Group',
    rssUrl: 'https://example.com/rss',
    episodes: [],
  }

  it('parses a legacy payload with no checkedAt/checkError/consecutiveFailures without throwing', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ replicas: [replicaFixture], jobs: [] }),
    )

    const result = await getHelperStatus('http://nas:17890', 'tok')

    expect(result.replicas).toHaveLength(1)
    const replica = result.replicas[0]
    expect(replica?.checkedAt).toBeUndefined()
    expect(replica?.checkError).toBeUndefined()
    expect(replica?.consecutiveFailures).toBeUndefined()
  })

  it('keeps a never-checked replica distinguishable from a checked-and-healthy one', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        replicas: [
          replicaFixture,
          {
            ...replicaFixture,
            id: 'r2',
            checkedAt: '2026-08-20T00:00:00Z',
            consecutiveFailures: 0,
          },
        ],
        jobs: [],
      }),
    )

    const result = await getHelperStatus('http://nas:17890', 'tok')

    const neverChecked = result.replicas.find((replica) => replica.id === 'r1')
    const checkedHealthy = result.replicas.find(
      (replica) => replica.id === 'r2',
    )

    expect(neverChecked?.checkedAt).toBeUndefined()
    expect(neverChecked?.consecutiveFailures).toBeUndefined()
    expect(checkedHealthy?.checkedAt).toBe('2026-08-20T00:00:00Z')
    expect(checkedHealthy?.consecutiveFailures).toBe(0)
    expect(checkedHealthy?.checkError).toBeUndefined()
  })

  it('carries a checkError alongside checkedAt and consecutiveFailures', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        replicas: [
          {
            ...replicaFixture,
            checkedAt: '2026-08-20T01:00:00Z',
            checkError: 'rss fetch failed',
            consecutiveFailures: 3,
          },
        ],
        jobs: [],
      }),
    )

    const result = await getHelperStatus('http://nas:17890', 'tok')

    expect(result.replicas[0]).toMatchObject({
      checkedAt: '2026-08-20T01:00:00Z',
      checkError: 'rss fetch failed',
      consecutiveFailures: 3,
    })
  })
})
