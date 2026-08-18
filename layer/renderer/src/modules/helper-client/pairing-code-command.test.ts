import { describe, expect, it } from 'vitest'

import { helperInstallCommand } from './install-command'
import {
  HELPER_PAIRING_CODE_COMMAND,
  HELPER_PAIRING_CODE_JOURNAL_COMMAND,
} from './pairing-code-command'

describe('helper pairing code commands', () => {
  it('reads the code from the binary the install command wrote', () => {
    expect(HELPER_PAIRING_CODE_COMMAND).toBe(
      '~/.local/bin/torrent-vibe-helper code',
    )
    const installed = helperInstallCommand({ arch: 'amd64' })
    expect(installed).toContain(
      HELPER_PAIRING_CODE_COMMAND.replace('~/', '$HOME/').replace(' code', ''),
    )
  })

  it('falls back to the user unit journal', () => {
    expect(HELPER_PAIRING_CODE_JOURNAL_COMMAND).toContain('journalctl --user')
    expect(HELPER_PAIRING_CODE_JOURNAL_COMMAND).toContain('torrent-vibe-helper')
    expect(HELPER_PAIRING_CODE_JOURNAL_COMMAND).toContain('pairing code')
  })
})
