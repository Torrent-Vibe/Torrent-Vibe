// Adapted from the MIT-licensed bencode helpers in @ctrl/torrent-file.
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const stringToBytes = (value: string) => textEncoder.encode(value)

const bytesToString = (value: Uint8Array) => textDecoder.decode(value)

const concatUint8Arrays = (chunks: Uint8Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}

const cmpRawString = (left: string, right: string) => {
  const a = stringToBytes(left)
  const b = stringToBytes(right)

  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }

  if (a.length === b.length) return 0
  return a.length < b.length ? -1 : 1
}

const isValidUtf8 = (buf: Uint8Array) => {
  let i = 0
  const len = buf.length

  while (i < len) {
    if (buf[i] <= 0x7f) {
      i += 1
      continue
    }

    if (buf[i] >= 0xc2 && buf[i] <= 0xdf && buf[i + 1] >> 6 === 2) {
      i += 2
      continue
    }

    if (
      ((buf[i] === 0xe0 && buf[i + 1] >= 0xa0 && buf[i + 1] <= 0xbf) ||
        (buf[i] === 0xed && buf[i + 1] >= 0x80 && buf[i + 1] <= 0x9f)) &&
      buf[i + 2] >> 6 === 2
    ) {
      i += 3
      continue
    }

    if (
      ((buf[i] >= 0xe1 && buf[i] <= 0xec) ||
        (buf[i] >= 0xee && buf[i] <= 0xef)) &&
      buf[i + 1] >> 6 === 2 &&
      buf[i + 2] >> 6 === 2
    ) {
      i += 3
      continue
    }

    if (
      ((buf[i] === 0xf0 && buf[i + 1] >= 0x90 && buf[i + 1] <= 0xbf) ||
        (buf[i] >= 0xf1 && buf[i] <= 0xf3 && buf[i + 1] >> 6 === 2) ||
        (buf[i] === 0xf4 && buf[i + 1] >= 0x80 && buf[i + 1] <= 0x8f)) &&
      buf[i + 2] >> 6 === 2 &&
      buf[i + 3] >> 6 === 2
    ) {
      i += 4
      continue
    }

    return false
  }

  return true
}

export type BencodeValue =
  | string
  | number
  | Uint8Array
  | BencodeValue[]
  | { [key: string]: BencodeValue }

export type BencodeDictionary = Record<string, BencodeValue>

type SupportedPayload =
  | string
  | ArrayBuffer
  | Uint8Array
  | { buffer: ArrayBuffer }

class Decoder {
  private idx = 0

  constructor(private readonly buf: Uint8Array) {}

  private readByte() {
    if (this.idx >= this.buf.length) {
      return null
    }

    return String.fromCodePoint(this.buf[this.idx++] ?? 0)
  }

  private readBytes(length: number) {
    if (this.idx + length > this.buf.length) {
      throw new Error(`could not read ${length} bytes, insufficient content`)
    }

    const result = this.buf.slice(this.idx, this.idx + length)
    this.idx += length
    return result
  }

  private readUntil(char: string) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined) {
      throw new Error('could not determine code point for terminator')
    }

    const targetIdx = this.buf.indexOf(codePoint, this.idx)

    if (targetIdx === -1) {
      throw new Error(`could not find terminated char: ${char}`)
    }

    const result = this.buf.slice(this.idx, targetIdx)
    this.idx = targetIdx
    return result
  }

  private readNumber() {
    const buf = this.readUntil(':')
    return Number.parseInt(bytesToString(buf), 10)
  }

  private peekByte() {
    if (this.idx >= this.buf.length) {
      return ''
    }

    const result = this.readByte()
    if (result === null) {
      return ''
    }

    this.idx -= 1
    return result
  }

  private assertByte(expected: string) {
    const b = this.readByte()
    if (b !== expected) {
      throw new Error(`expected ${expected}, got ${b ?? 'null'}`)
    }
  }

  decodeValue(): BencodeValue {
    switch (this.peekByte()) {
      case 'd': {
        return this.decodeDictionary()
      }
      case 'l': {
        return this.decodeList()
      }
      case 'i': {
        return this.decodeInteger()
      }
      default: {
        return this.decodeBytesOrString()
      }
    }
  }

  private decodeBytesOrString() {
    const length = this.readNumber()
    this.assertByte(':')
    const value = this.readBytes(length)
    return isValidUtf8(value) ? bytesToString(value) : value
  }

  private decodeString() {
    const length = this.readNumber()
    this.assertByte(':')
    return bytesToString(this.readBytes(length))
  }

  private decodeInteger() {
    this.assertByte('i')
    const content = bytesToString(this.readUntil('e'))
    this.assertByte('e')

    const result = Number(content)
    if (Number.isNaN(result)) {
      throw new TypeError(`not a number: ${content}`)
    }

    return result
  }

  private decodeList() {
    this.assertByte('l')
    const result: BencodeValue[] = []

    while (this.peekByte() !== 'e') {
      result.push(this.decodeValue())
    }

    this.assertByte('e')
    return result
  }

  private decodeDictionary() {
    this.assertByte('d')
    const result: Record<string, BencodeValue> = {}

    while (this.peekByte() !== 'e') {
      const key = this.decodeString()
      result[key] = this.decodeValue()
    }

    this.assertByte('e')
    return result
  }
}

const normalizePayload = (payload: SupportedPayload): Uint8Array => {
  if (typeof payload === 'string') {
    return stringToBytes(payload)
  }

  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload)
  }

  if (payload instanceof Uint8Array) {
    return payload
  }

  if ('buffer' in payload) {
    return new Uint8Array(payload.buffer)
  }

  throw new Error('invalid payload type')
}

export const decodeBencode = (payload: SupportedPayload): BencodeValue => {
  const decoder = new Decoder(normalizePayload(payload))
  return decoder.decodeValue()
}

const encodeBytes = (buf: Uint8Array) => {
  const lengthBytes = stringToBytes(buf.byteLength.toString())
  const delimiter = stringToBytes(':')
  return concatUint8Arrays([lengthBytes, delimiter, buf])
}

const encodeString = (value: string) => encodeBytes(stringToBytes(value))

const encodeNumber = (value: number) => {
  const int = Math.trunc(value)
  if (int !== value) {
    throw new Error(`bencode only supports integers, got ${value}`)
  }

  return concatUint8Arrays([
    stringToBytes('i'),
    stringToBytes(int.toString()),
    stringToBytes('e'),
  ])
}

const encodeDictionary = (value: BencodeDictionary) => {
  const chunks: Uint8Array[] = [stringToBytes('d')]
  const keys = Object.keys(value).sort(cmpRawString)

  for (const key of keys) {
    chunks.push(encodeString(key), encodeBencode(value[key]))
  }

  chunks.push(stringToBytes('e'))
  return concatUint8Arrays(chunks)
}

const encodeArray = (value: BencodeValue[]) => {
  const chunks: Uint8Array[] = [stringToBytes('l')]
  for (const item of value) {
    chunks.push(encodeBencode(item))
  }
  chunks.push(stringToBytes('e'))
  return concatUint8Arrays(chunks)
}

export const encodeBencode = (value: BencodeValue): Uint8Array => {
  if (value instanceof Uint8Array) {
    return encodeBytes(value)
  }

  if (Array.isArray(value)) {
    return encodeArray(value)
  }

  switch (typeof value) {
    case 'string': {
      return encodeString(value)
    }
    case 'number': {
      return encodeNumber(value)
    }
    case 'object': {
      if (value === null) {
        throw new Error('cannot encode null')
      }
      return encodeDictionary(value as BencodeDictionary)
    }
    default: {
      throw new Error(`unsupported data type: ${typeof value}`)
    }
  }
}
