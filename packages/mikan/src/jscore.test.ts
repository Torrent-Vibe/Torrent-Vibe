import { describe, expect, it } from 'vitest'

import { bridgeVersion, invoke } from './jscore'

describe('JavaScriptCore bridge', () => {
  it('returns a versioned JSON envelope for a season wall', () => {
    const html = `
      <div class="sk-col date-text">2026 夏</div>
      <div class="sk-bangumi" data-dayofweek="2">
        <li data-bangumiid="42">
          <img data-src="/images/42.webp">
          <div class="an-text" title="测试番组"></div>
        </li>
      </div>
    `

    expect(bridgeVersion).toBe(1)
    expect(JSON.parse(invoke('seasonWall', JSON.stringify({ html })))).toEqual({
      ok: true,
      value: {
        year: 2026,
        season: '夏',
        groups: [
          {
            weekday: 2,
            items: [
              {
                bangumiId: '42',
                title: '测试番组',
                coverUrl: '/images/42.webp',
                weekday: 2,
              },
            ],
          },
        ],
      },
    })
  })

  it('returns a structured error for an unknown operation', () => {
    expect(
      JSON.parse(invoke('unknown' as never, JSON.stringify({}))),
    ).toMatchObject({
      ok: false,
      error: { code: 'parserFailure' },
    })
  })
})
