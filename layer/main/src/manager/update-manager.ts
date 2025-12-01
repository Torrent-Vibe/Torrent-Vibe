import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'

import { app } from 'electron/main'
import log from 'electron-log'
import { join } from 'pathe'
import { extract, list } from 'tar'

import { getUpdateDir, getUpdateLockPath } from '~/config/paths'
import { UpdateDecryptor } from '~/utils/decrypt-update'

/**
 * Coordinates update package extraction with a simple lock file to avoid
 * concurrent writes. Handles signature verification, decryption and archive
 * extraction into the user's update directory.
 */
export class UpdateManager {
  private static instance: UpdateManager | null = null
  private logger = log.scope('UpdateManager')
  static getInstance(): UpdateManager {
    if (!this.instance) this.instance = new UpdateManager()
    return this.instance
  }

  private lockPath = getUpdateLockPath()
  private updateDir = getUpdateDir()

  private acquireLock(): number {
    return openSync(this.lockPath, 'wx')
  }

  private releaseLock(fd: number) {
    closeSync(fd)
    unlinkSync(this.lockPath)
  }

  private loadSigningPublicKey(): string {
    const base = app.isPackaged
      ? process.resourcesPath
      : join(process.cwd(), 'resources')
    // Prefer dedicated signing public key; fall back to legacy update_pubkey.pem for compatibility
    const signPubPref = join(base, 'security', 'update_sign_pub.pem')
    const legacy = join(base, 'security', 'update_pubkey.pem')
    try {
      return readFileSync(signPubPref, 'utf8')
    } catch {
      return readFileSync(legacy, 'utf8')
    }
  }

  private loadDecryptionPrivateKey(): string {
    const base = app.isPackaged
      ? process.resourcesPath
      : join(process.cwd(), 'resources')
    const p = join(base, 'security', 'update_privkey.pem')
    return readFileSync(p, 'utf8')
  }

  private readCurrentMainHashFromPackage(): string | null {
    try {
      if (!app.isPackaged) return null
      const pkgPath = join(app.getAppPath(), 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as any
      const hash: string | undefined = pkg.mainHash
      if (!hash) return null
      return String(hash)
    } catch (e) {
      this.logger.error('Failed to read mainHash from package.json:', e)
      return null
    }
  }

  private async extractTarGz(tarGzPath: string, dest: string) {
    try {
      // First, check if the archive has a top-level 'dist' directory
      const entries: string[] = []
      await list({
        file: tarGzPath,
        onentry: (entry) => {
          entries.push(entry.path)
        },
      })

      // Check if all entries start with 'dist/' (indicating a dist wrapper)
      const hasDistWrapper =
        entries.length > 0 &&
        entries.every((entry) => entry.startsWith('dist/') || entry === 'dist')

      const stripLevels = hasDistWrapper ? 1 : 0
      this.logger.info(
        `Extracting with strip=${stripLevels} (dist wrapper: ${hasDistWrapper})`,
      )

      await extract({
        file: tarGzPath,
        cwd: dest,
        strip: stripLevels,
      })
      this.logger.info(`Successfully extracted ${tarGzPath} to ${dest}`)
    } catch (error) {
      this.logger.error(`Failed to extract ${tarGzPath}:`, error)
      throw new Error(
        `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  async extractUpdate(packagePath: string) {
    let fd: number | null = null
    try {
      fd = this.acquireLock()
    } catch {
      throw new Error('Another update is in progress')
    }
    try {
      const pubPem = this.loadSigningPublicKey()
      const privPem = this.loadDecryptionPrivateKey()
      const decryptor = new UpdateDecryptor(pubPem, privPem)

      try {
        const { decrypted, parsed } = await decryptor.decryptFile(packagePath)
        this.logger.info(`Decrypted update package: ${packagePath}`)
        this.logger.info(`Decrypted update package version: ${parsed.version}`)
        this.logger.info(
          `Decrypted update package size: ${decrypted.length} bytes`,
        )

        // Compatibility is validated in UpdateService using manifest.yaml
        try {
          if (!existsSync(this.updateDir))
            mkdirSync(this.updateDir, { recursive: true })
          const tarGzPath = join(this.updateDir, `${parsed.version}.tar.gz`)
          this.logger.info(`Writing decrypted update package to: ${tarGzPath}`)
          writeFileSync(tarGzPath, decrypted)
          const dest = join(this.updateDir, parsed.version)
          if (!existsSync(dest)) mkdirSync(dest)
          await this.extractTarGz(tarGzPath, dest)
          unlinkSync(tarGzPath)
        } catch (e) {
          this.logger.error(
            'Failed to extract update package, write to disk failed:',
            e,
          )
          throw new Error(
            'Failed to extract update package, write to disk failed',
          )
        }
      } catch {
        throw new Error(
          'Failed to decrypt update package, maybe the app is outdated, please update to the latest version',
        )
      }
    } finally {
      if (fd !== null) this.releaseLock(fd)
    }
  }
}
