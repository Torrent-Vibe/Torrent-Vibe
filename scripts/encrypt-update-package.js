#!/usr/bin/env node
import {
  constants,
  createCipheriv,
  createHash,
  createSign,
  publicEncrypt,
  randomBytes,
} from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { argv } from 'node:process'

function getArg(name) {
  const index = argv.indexOf(`--${name}`)
  if (index === -1 || index + 1 >= argv.length) {
    throw new Error(`Missing --${name}`)
  }
  return argv[index + 1]
}

const input = getArg('input')
// --public-key: encryption public key (pairs with client-deployed decryption private key)
// --private-key: signing private key (kept only in CI secrets)
const publicKeyPath = getArg('public-key')
const privateKeyPath = getArg('private-key')
const version = getArg('version')
const output = getArg('output')

const data = readFileSync(input)

// 1) Encrypt payload with AES-256-GCM
const aesKey = randomBytes(32)
const iv = randomBytes(12)
const cipher = createCipheriv('aes-256-gcm', aesKey, iv)
const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
const authTag = cipher.getAuthTag()

// 2) Encrypt AES key with RSA-OAEP (SHA-256)
const encryptedKey = publicEncrypt(
  {
    key: readFileSync(publicKeyPath, 'utf8'),
    padding: constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256',
  },
  aesKey,
)

// 3) Build compact binary package with the following layout:
// [4 bytes magic "QUPD"]
// [1 byte formatVersion=1]
// [1 byte versionStringLength]
// [N bytes versionString (utf8)]
// [32 bytes originalHash (sha256 of plaintext payload)]
// [2 bytes encryptedKeyLength BE]
// [M bytes encryptedKey]
// [1 byte ivLength]
// [ivLength bytes iv]
// [1 byte authTagLength]
// [authTagLength bytes authTag]
// [4 bytes payloadLength BE]
// [payloadLength bytes encryptedPayload]
// [2 bytes signatureLength BE]
// [signatureLength bytes signature over everything above]

const magic = Buffer.from('QUPD', 'ascii')
const formatVersion = Buffer.from([1])
const versionBuf = Buffer.from(version, 'utf8')
if (versionBuf.length > 255) {
  throw new Error('Version string too long (max 255 bytes)')
}
const versionLen = Buffer.from([versionBuf.length])
const originalHashRaw = createHash('sha256').update(data).digest()

const encKeyLen = Buffer.alloc(2)
encKeyLen.writeUInt16BE(encryptedKey.length, 0)
const ivLen = Buffer.from([iv.length])
const authTagLen = Buffer.from([authTag.length])
const payloadLen = Buffer.alloc(4)
payloadLen.writeUInt32BE(encrypted.length, 0)

// Content to be signed (everything before the signature length/value)
const contentWithoutSig = Buffer.concat([
  magic,
  formatVersion,
  versionLen,
  versionBuf,
  originalHashRaw,
  encKeyLen,
  encryptedKey,
  ivLen,
  iv,
  authTagLen,
  authTag,
  payloadLen,
  encrypted,
])

// 4) Sign the content with the private key (RSA-SHA256)
const signer = createSign('RSA-SHA256')
signer.update(contentWithoutSig)
const signature = signer.sign(readFileSync(privateKeyPath, 'utf8'))
const sigLen = Buffer.alloc(2)
sigLen.writeUInt16BE(signature.length, 0)

const finalBuffer = Buffer.concat([contentWithoutSig, sigLen, signature])
writeFileSync(output, finalBuffer)
console.info('[encrypt-update] wrote binary package', output)
