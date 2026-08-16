import { describe, expect, it } from 'vitest'

import { helperInstallCommand } from './install-command'

describe('helperInstallCommand', () => {
  it('uses the linux amd64 asset and ends by running the binary', () => {
    const command = helperInstallCommand({ arch: 'amd64' })
    expect(command).toContain('torrent-vibe-helper_linux_amd64')
    expect(command).toContain('chmod +x torrent-vibe-helper')
    expect(command.trim().endsWith('torrent-vibe-helper')).toBe(true)
  })

  it('swaps the arm64 asset name', () => {
    expect(helperInstallCommand({ arch: 'arm64' })).toContain(
      'torrent-vibe-helper_linux_arm64',
    )
  })
})
