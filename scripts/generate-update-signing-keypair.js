#!/usr/bin/env node
// Generates an RSA key pair for update package encryption (soft encryption).
// NOTE: Do NOT use this keypair for signing releases. The signing private
// key must live only in CI secrets, and the app should embed only the signing
// public key under resources/security/update_sign_pub.pem.
import { generateKeyPairSync } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = join(process.cwd(), 'resources/security')
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}

// If keypair is exist, do nothing;
if (
  existsSync(join(outDir, 'update_pubkey.pem')) &&
  existsSync(join(outDir, 'update_privkey.pem'))
) {
  console.info('[update-sign] keypair already exists')
  process.exit(0)
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

writeFileSync(join(outDir, 'update_pubkey.pem'), publicKey)
writeFileSync(join(outDir, 'update_privkey.pem'), privateKey)

console.info('[update-sign] generated RSA keypair at', outDir)
