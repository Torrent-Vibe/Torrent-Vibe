import { describe, expect, it } from 'vitest'

import { helperInstallCommand } from './install-command'

describe('helperInstallCommand', () => {
  it('installs the linux amd64 binary into ~/.local/bin and starts the daemon', () => {
    const command = helperInstallCommand({ arch: 'amd64' })
    expect(command).toContain('torrent-vibe-helper_linux_amd64')
    expect(command).toContain('chmod +x')
    expect(command).toContain('$HOME/.local/bin/torrent-vibe-helper')
    expect(command.trim().endsWith('install')).toBe(true)
  })

  it('swaps the arm64 asset name', () => {
    expect(helperInstallCommand({ arch: 'arm64' })).toContain(
      'torrent-vibe-helper_linux_arm64',
    )
  })
})
