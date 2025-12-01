import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'

export class UpdateDecryptor {
  private publicKeyPem: string
  private privateKeyPem: string

  constructor(publicKeyPem: string, privateKeyPem: string) {
    this.publicKeyPem = publicKeyPem
    this.privateKeyPem = privateKeyPem
  }

  async decryptFile(packagePath: string): Promise<{
    decrypted: Buffer
    parsed: ReturnType<typeof parseBinaryPackage>
  }> {
    const buf = readFileSync(packagePath)
    const parsed = parseBinaryPackage(buf)

    const sigOk = crypto.verify(
      'RSA-SHA256',
      parsed.contentForVerification,
      this.publicKeyPem,
      parsed.signature,
    )
    if (!sigOk) throw new Error('Invalid package signature')

    const aesKey = crypto.privateDecrypt(
      {
        key: this.privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      parsed.encryptedKey,
    )

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, parsed.iv)
    decipher.setAuthTag(parsed.authTag)
    const decrypted = Buffer.concat([
      decipher.update(parsed.encryptedPayload),
      decipher.final(),
    ])

    const hash = crypto.createHash('sha256').update(decrypted).digest()
    if (!hash.equals(parsed.originalHash)) {
      throw new Error('Checksum mismatch')
    }

    return { decrypted, parsed }
  }
}

function parseBinaryPackage(data: Buffer): {
  version: string
  originalHash: Buffer
  metadata?: {
    requiredMainVersionRange?: string
    requiredMainHash?: string
    createdAt?: string
    [k: string]: unknown
  }
  encryptedKey: Buffer
  iv: Buffer
  authTag: Buffer
  encryptedPayload: Buffer
  signature: Buffer
  contentForVerification: Buffer
} {
  let offset = 0

  const requireLength = (needed: number, what: string) => {
    if (offset + needed > data.length) {
      throw new Error(`Malformed package: insufficient data for ${what}`)
    }
  }

  // Magic
  requireLength(4, 'magic')
  const magic = data.subarray(offset, offset + 4)
  offset += 4
  if (magic.toString('ascii') !== 'QUPD') {
    throw new Error('Invalid package magic header')
  }

  // Format version
  requireLength(1, 'format version')
  const formatVersion = data.readUInt8(offset)
  offset += 1
  if (formatVersion !== 1 && formatVersion !== 2) {
    throw new Error(`Unsupported package version: ${formatVersion}`)
  }

  // Version string length + value
  requireLength(1, 'version length')
  const versionLength = data.readUInt8(offset)
  offset += 1
  requireLength(versionLength, 'version string')
  const version = data.subarray(offset, offset + versionLength).toString('utf8')
  offset += versionLength

  // Original hash (32 bytes)
  requireLength(32, 'original hash')
  const originalHash = data.subarray(offset, offset + 32)
  offset += 32

  // Optional metadata (v2+)
  let metadata: Record<string, unknown> | undefined
  if (formatVersion >= 2) {
    requireLength(2, 'metadata length')
    const metaLen = data.readUInt16BE(offset)
    offset += 2
    requireLength(metaLen, 'metadata')
    const metaBuf = data.subarray(offset, offset + metaLen)
    offset += metaLen
    try {
      metadata = JSON.parse(metaBuf.toString('utf8')) as Record<string, unknown>
    } catch {
      throw new Error('Malformed package metadata JSON')
    }
  }

  // Encrypted key length (2 bytes BE) + value
  requireLength(2, 'encrypted key length')
  const encryptedKeyLength = data.readUInt16BE(offset)
  offset += 2
  requireLength(encryptedKeyLength, 'encrypted key')
  const encryptedKey = data.subarray(offset, offset + encryptedKeyLength)
  offset += encryptedKeyLength

  // iv length (1) + iv
  requireLength(1, 'iv length')
  const ivLength = data.readUInt8(offset)
  offset += 1
  requireLength(ivLength, 'iv')
  const iv = data.subarray(offset, offset + ivLength)
  offset += ivLength

  // authTag length (1) + authTag
  requireLength(1, 'authTag length')
  const authTagLength = data.readUInt8(offset)
  offset += 1
  requireLength(authTagLength, 'authTag')
  const authTag = data.subarray(offset, offset + authTagLength)
  offset += authTagLength

  // payload length (4 bytes BE) + payload
  requireLength(4, 'payload length')
  const payloadLength = data.readUInt32BE(offset)
  offset += 4
  requireLength(payloadLength, 'payload')
  const encryptedPayload = data.subarray(offset, offset + payloadLength)
  offset += payloadLength

  // Capture everything up to (but not including) the signature for verification
  const contentForVerification = data.subarray(0, offset)

  // signature length (2 bytes BE) + signature
  requireLength(2, 'signature length')
  const signatureLength = data.readUInt16BE(offset)
  offset += 2
  requireLength(signatureLength, 'signature')
  const signature = data.subarray(offset, offset + signatureLength)
  offset += signatureLength

  if (offset !== data.length) {
    // Extra trailing bytes should not exist; treat as malformed to prevent smuggling
    throw new Error('Malformed package: unexpected trailing data')
  }

  return {
    version,
    originalHash,
    metadata: metadata as any,
    encryptedKey,
    iv,
    authTag,
    encryptedPayload,
    signature,
    contentForVerification,
  }
}
