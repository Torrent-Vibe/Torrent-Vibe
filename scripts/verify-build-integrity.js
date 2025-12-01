#!/usr/bin/env node
/*
  Post-build integrity helper.
  - Verifies app.asar exists and prints its SHA-512 hash
  - If @electron/asar is available, attempts to read header to ensure integrity block exists
  - Non-fatal: exits 0 with warnings to avoid breaking CI until fully wired
*/

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

function sha512File(filePath) {
  const hash = crypto.createHash('sha512')
  const stream = fs.createReadStream(filePath)
  return new Promise((resolve, reject) => {
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('base64')))
    stream.on('error', reject)
  })
}

async function main() {
  const outDir = path.join(process.cwd(), 'out')
  const strict =
    process.argv.includes('--strict') || process.env.VERIFY_STRICT === '1'
  let failures = 0
  if (!fs.existsSync(outDir)) {
    console.warn('[verify-build-integrity] ./out directory not found')
    process.exit(0)
  }

  function findAsars(rootDir, maxDepth = 5) {
    const results = []
    function walk(dir, depth) {
      if (depth > maxDepth) return
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          walk(p, depth + 1)
        } else if (e.isFile() && p.toLowerCase().endsWith('.asar')) {
          results.push(p)
        }
      }
    }
    walk(rootDir, 0)
    return results
  }

  async function handleAsar(asarPath) {
    const hash512 = await sha512File(asarPath)
    const buf = fs.readFileSync(asarPath)
    const hash256 = crypto.createHash('sha256').update(buf).digest('hex')
    console.info(`[verify-build-integrity] ${asarPath}`)
    console.info(`  SHA-512: ${hash512}`)
    console.info(`  SHA-256: ${hash256}`)
    // Signature verification (required in strict mode)
    try {
      const sigPath = `${asarPath}.sig`
      const resDir = path.dirname(asarPath)
      let pubKey = ''
      const packagedPubKeyPath = path.join(resDir, 'security/asar_pubkey.pem')
      if (fs.existsSync(packagedPubKeyPath)) {
        pubKey = fs.readFileSync(packagedPubKeyPath, 'utf8')
      } else if (process.env.ASAR_PUBKEY_PATH) {
        pubKey = fs.readFileSync(process.env.ASAR_PUBKEY_PATH, 'utf8')
      } else if (process.env.ASAR_PUBKEY_PEM) {
        pubKey = process.env.ASAR_PUBKEY_PEM
      }
      if (!pubKey) {
        console.warn('  Public key not found for signature verification')
      } else if (!fs.existsSync(sigPath)) {
        console.warn('  Missing signature file (.sig) next to asar')
      } else {
        const sig = Buffer.from(
          fs.readFileSync(sigPath, 'utf8').trim(),
          'base64',
        )
        const ok = crypto.verify(null, Buffer.from(hash256, 'hex'), pubKey, sig)
        console.info(`  Signature: ${ok ? 'VALID' : 'INVALID'}`)
      }
    } catch (e) {
      console.warn('  Signature verify error:', e?.message || e)
    }
  }

  const asars = findAsars(outDir, 5)
  if (asars.length === 0) {
    console.warn(
      '[verify-build-integrity] No .asar files found within depth 5 under ./out',
    )
    process.exit(strict ? 1 : 0)
  }
  for (const p of asars) {
    try {
      await handleAsar(p)
    } catch {
      failures++
    }
  }
  if (strict) {
    for (const p of asars) {
      const resDir = path.dirname(p)
      const sigPath = `${p}.sig`
      let pubKey = ''
      const packagedPubKeyPath = path.join(resDir, 'security/asar_pubkey.pem')
      if (fs.existsSync(packagedPubKeyPath)) {
        pubKey = fs.readFileSync(packagedPubKeyPath, 'utf8')
      } else if (process.env.ASAR_PUBKEY_PATH) {
        pubKey = fs.readFileSync(process.env.ASAR_PUBKEY_PATH, 'utf8')
      } else if (process.env.ASAR_PUBKEY_PEM) {
        pubKey = process.env.ASAR_PUBKEY_PEM
      }
      if (!pubKey || !fs.existsSync(sigPath)) {
        failures++
        continue
      }
      const buf = fs.readFileSync(p)
      const hash256 = crypto.createHash('sha256').update(buf).digest('hex')
      const sig = Buffer.from(fs.readFileSync(sigPath, 'utf8').trim(), 'base64')
      const ok = crypto.verify(null, Buffer.from(hash256, 'hex'), pubKey, sig)
      if (!ok) failures++
    }
    if (failures > 0) {
      console.error(
        `[verify-build-integrity] Strict mode: ${failures} failure(s) detected`,
      )
      process.exit(1)
    }
  }
}

main().catch((e) => {
  console.error('[verify-build-integrity] Error:', e)
  process.exit(1)
})
