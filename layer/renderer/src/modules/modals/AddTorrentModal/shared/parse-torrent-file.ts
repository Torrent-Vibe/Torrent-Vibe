import {
  files as parseTorrentFiles,
  info as parseTorrentInfo,
} from '@ctrl/torrent-file'

import type { BencodeDictionary } from './bencode'
import { decodeBencode, encodeBencode } from './bencode'

export interface ParsedTorrentFile {
  infoHash: string
  name: string
  files: Array<{
    index: number
    path: string
    size: number
  }>
  totalSize: number
}

const computeInfoHash = async (data: Uint8Array) => {
  const torrent = decodeBencode(data)

  if (!torrent || typeof torrent !== 'object' || Array.isArray(torrent)) {
    throw new Error('Invalid torrent metadata')
  }

  const {info} = (torrent as { info?: unknown })
  if (!info || typeof info !== 'object' || Array.isArray(info)) {
    throw new Error('Invalid torrent metadata')
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is unavailable in this environment')
  }

  const encodedInfo = encodeBencode(info as BencodeDictionary)
  const normalized = new Uint8Array(encodedInfo)
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-1',
    normalized.buffer,
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export const parseTorrentFile = async (
  file: File | Blob,
): Promise<ParsedTorrentFile> => {
  const data = new Uint8Array(await file.arrayBuffer())

  const parsedFiles = parseTorrentFiles(data)
  const metadata = parseTorrentInfo(data)
  const infoHash = await computeInfoHash(data)

  const files = parsedFiles.files.map((item, index) => ({
    index,
    path: item.path,
    size: item.length,
  }))

  return {
    infoHash,
    name: metadata.name,
    files,
    totalSize: parsedFiles.length,
  }
}
