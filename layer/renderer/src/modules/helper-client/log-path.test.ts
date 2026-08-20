import { describe, expect, it } from 'vitest'

import { helperLogFilePath } from './log-path'

describe('helperLogFilePath', () => {
  it('resolves to the default Helper data directory log file', () => {
    expect(helperLogFilePath()).toBe(
      '~/.local/share/torrent-vibe-helper/logs/helper.log',
    )
  })
})
