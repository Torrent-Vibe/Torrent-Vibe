#!/usr/bin/env node
// Writes <asar>.sig next to every .asar found under ./out (depth<=5)
import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign as nodeSign,
} from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

function sha256FileHex(p) {
  const h = createHash('sha256')
  const data = readFileSync(p)
  h.update(data)
  return h.digest('hex')
}

function findAsars(rootDir, maxDepth = 5) {
  const results = []
  function walk(dir, depth) {
    if (depth > maxDepth) return
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(dir, e.name)
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

function main() {
  const outDir = join(process.cwd(), 'out')
  if (!existsSync(outDir)) {
    console.error('[sign-asar] ./out directory not found')
    process.exit(1)
  }
  const asars = findAsars(outDir, 5)
  if (asars.length === 0) {
    console.error('[sign-asar] No .asar files found under ./out')
    process.exit(1)
  }
  let privPem = process.env.SIGN_ASAR_PRIVKEY_PEM || ''
  if (!privPem && process.env.SIGN_ASAR_PRIVKEY_PATH) {
    privPem = readFileSync(process.env.SIGN_ASAR_PRIVKEY_PATH, 'utf8')
  }
  if (!privPem) {
    // fallback to dev key under resources/security
    const secDir = join(process.cwd(), 'resources/security')
    if (!existsSync(secDir)) mkdirSync(secDir, { recursive: true })
    const privPath = join(secDir, 'asar_private.pem')
    const pubPath = join(secDir, 'asar_pubkey.pem')
    if (!existsSync(privPath) || !existsSync(pubPath)) {
      const { privateKey, publicKey } = generateKeyPairSync('ed25519')
      writeFileSync(
        privPath,
        privateKey.export({ type: 'pkcs8', format: 'pem' }),
      )
      writeFileSync(pubPath, publicKey.export({ type: 'spki', format: 'pem' }))
      console.info('[sign-asar] generated dev keypair at resources/security')
    }
    privPem = readFileSync(privPath, 'utf8')
  }
  const key = createPrivateKey(privPem)
  for (const asarPath of asars) {
    const hash = sha256FileHex(asarPath)
    const sig = nodeSign(null, Buffer.from(hash, 'hex'), key)
    const sigTarget = `${asarPath}.sig`
    writeFileSync(sigTarget, `${sig.toString('base64')}\n`, 'utf8')
    console.info(`[sign-asar] Wrote ${sigTarget}`)
    // Clean legacy .sha256 if exists
    const legacy = `${asarPath}.sha256`
    try {
      if (existsSync(legacy)) {
        require('node:fs').unlinkSync(legacy)
        console.info(`[sign-asar] Removed legacy ${legacy}`)
      }
    } catch {
      // ignore
    }
  }
}

main()
