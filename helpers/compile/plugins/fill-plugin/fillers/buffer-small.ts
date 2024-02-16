/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
export interface Buffer {
  readBigInt64BE(offset: number): bigint
  readBigInt64BE(offset: number): bigint
  readBigInt64LE(offset: number): bigint
  readBigInt64LE(offset: number): bigint
  readBigUint64BE(offset: number): bigint
  readBigUInt64BE(offset: number): bigint
  readBigUint64LE(offset: number): bigint
  readBigUInt64LE(offset: number): bigint
  readDoubleBE(offset: number): number
  readDoubleLE(offset: number): number
  readFloatBE(offset: number): number
  readFloatLE(offset: number): number
  readInt16BE(offset: number): number
  readInt16LE(offset: number): number
  readInt32BE(offset: number): number
  readInt32LE(offset: number): number
  readInt8(offset: number): number
  readIntBE(offset: number, byteLength: number): number
  readIntLE(offset: number, byteLength: number): number
  readUint16BE(offset: number): number
  readUInt16BE(offset: number): number
  readUint16LE(offset: number): number
  readUInt16LE(offset: number): number
  readUint32BE(offset: number): number
  readUInt32BE(offset: number): number
  readUint32LE(offset: number): number
  readUInt32LE(offset: number): number
  readUint8(offset: number): number
  readUInt8(offset: number): number
  readUInt8(offset: number): number
  readUintBE(offset: number, byteLength: number): number
  readUIntBE(offset: number, byteLength: number): number
  readUintLE(offset: number, byteLength: number): number
  readUIntLE(offset: number, byteLength: number): number
  writeBigInt64BE(value: bigint, offset: number): void
  writeBigInt64BE(value: bigint, offset: number): void
  writeBigInt64LE(value: bigint, offset: number): void
  writeBigInt64LE(value: bigint, offset: number): void
  writeBigUint64BE(value: bigint, offset: number): void
  writeBigUInt64BE(value: bigint, offset: number): void
  writeBigUint64LE(value: bigint, offset: number): void
  writeBigUInt64LE(value: bigint, offset: number): void
  writeDoubleBE(value: number, offset: number): void
  writeDoubleLE(value: number, offset: number): void
  writeFloatBE(value: number, offset: number): void
  writeFloatLE(value: number, offset: number): void
  writeInt16BE(value: number, offset: number): void
  writeInt16LE(value: number, offset: number): void
  writeInt32BE(value: number, offset: number): void
  writeInt32LE(value: number, offset: number): void
  writeInt8(value: number, offset: number): void
  writeIntBE(value: number, offset: number, byteLength: number): void
  writeIntLE(value: number, offset: number, byteLength: number): void
  writeUint16BE(value: number, offset: number): void
  writeUInt16BE(value: number, offset: number): void
  writeUint16LE(value: number, offset: number): void
  writeUInt16LE(value: number, offset: number): void
  writeUint32BE(value: number, offset: number): void
  writeUInt32BE(value: number, offset: number): void
  writeUint32LE(value: number, offset: number): void
  writeUInt32LE(value: number, offset: number): void
  writeUint8(value: number, offset: number): void
  writeUInt8(value: number, offset: number): void
  writeUintBE(value: number, offset: number, byteLength: number): void
  writeUIntBE(value: number, offset: number, byteLength: number): void
  writeUintLE(value: number, offset: number, byteLength: number): void
  writeUIntLE(value: number, offset: number, byteLength: number): void
}

export class Buffer extends Uint8Array /* implements NodeBuffer */ {
  readonly _isBuffer = true

  get offset() {
    return this.byteOffset
  }

  static alloc(size: number, fill: string | number | Uint8Array = 0, encoding?: Encoding) {
    return Buffer.allocUnsafe(size).fill(fill, encoding)
  }

  static allocUnsafe(size: number) {
    return new Buffer(new Uint8Array(size))
  }

  static allocUnsafeSlow(size: number) {
    return new Buffer(new Uint8Array(size))
  }

  static isBuffer(arg: any): arg is Buffer {
    return arg && !!arg._isBuffer
  }

  static byteLength(string: string, encoding: Encoding = 'utf8') {
    return Buffer.from(string, encoding).length
  }

  static compare(a: Uint8Array, b: Uint8Array) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return -1
      if (a[i] > b[i]) return 1
    }

    return a.length === b.length ? 0 : a.length > b.length ? 1 : -1
  }

  static from(value: unknown, encoding: any = 'utf8'): Buffer {
    if (value && typeof value === 'object' && value['type'] === 'Buffer') {
      return new Buffer(value['data'])
    }

    if (typeof value === 'number') {
      return new Buffer(new Uint8Array(value))
    }

    if (typeof value === 'string' && typeof encoding === 'string') {
      return stringToBuffer(value, encoding)
    }

    if (typeof value === 'object' && ArrayBuffer.isView(value)) {
      return new Buffer(value.buffer, value.byteOffset, value.byteLength)
    }

    return new Buffer(value as ArrayLike<number>)
  }

  static concat(list: readonly Uint8Array[], totalLength?: number) {
    if (list.length === 0) return Buffer.alloc(0)

    const concat = ([] as number[]).concat(...list.map((item) => [...item]))
    const result = Buffer.alloc(totalLength !== undefined ? totalLength : concat.length)

    result.set(totalLength !== undefined ? concat.slice(0, totalLength) : concat)

    return result
  }

  slice(start = 0, end = this.length) {
    return this.subarray(start, end)
  }

  subarray(start = 0, end = this.length) {
    return Object.setPrototypeOf(super.subarray(start, end), Buffer.prototype) as Buffer
  }

  reverse() {
    super.reverse()

    return this
  }

  readIntBE(offset: number, byteLength: number) {
    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val = val * 0x100 + view.getUint8(i)
    }

    if (view.getUint8(0) & 0x80) {
      val -= Math.pow(0x100, byteLength)
    }

    return val
  }

  readIntLE(offset: number, byteLength: number) {
    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val += view.getUint8(i) * Math.pow(0x100, i)
    }

    if (view.getUint8(byteLength - 1) & 0x80) {
      val -= Math.pow(0x100, byteLength)
    }

    return val
  }

  readUIntBE(offset: number, byteLength: number) {
    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val = val * 0x100 + view.getUint8(i)
    }

    return val
  }

  readUintBE(offset: number, byteLength: number) {
    return this.readUIntBE(offset, byteLength)
  }

  readUIntLE(offset: number, byteLength: number) {
    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val += view.getUint8(i) * Math.pow(0x100, i)
    }

    return val
  }

  readUintLE(offset: number, byteLength: number) {
    return this.readUIntLE(offset, byteLength)
  }

  writeIntBE(value: number, offset: number, byteLength: number) {
    value = value < 0 ? value + Math.pow(0x100, byteLength) : value
    this.writeUIntBE(value, offset, byteLength)
  }

  writeIntLE(value: number, offset: number, byteLength: number) {
    value = value < 0 ? value + Math.pow(0x100, byteLength) : value
    this.writeUIntLE(value, offset, byteLength)
  }

  writeUIntBE(value: number, offset: number, byteLength: number) {
    const view = new DataView(this.buffer, offset, byteLength)
    for (let i = byteLength - 1; i >= 0; i--) {
      view.setUint8(i, value & 0xff)
      value = value / 0x100
    }

    return offset + byteLength
  }

  writeUintBE(value: number, offset: number, byteLength: number) {
    return this.writeUIntBE(value, offset, byteLength)
  }

  writeUIntLE(value: number, offset: number, byteLength: number) {
    const view = new DataView(this.buffer, offset, byteLength)
    for (let i = 0; i < byteLength; i++) {
      view.setUint8(i, value & 0xff) // bitwise 0xff is to get the last 8 bits
      value = value / 0x100 // shift 8 bits to the right to iterate
    }

    return offset + byteLength
  }

  writeUintLE(value: number, offset: number, byteLength: number) {
    return this.writeUIntLE(value, offset, byteLength)
  }

  toJSON() {
    return { type: 'Buffer', data: Array.from(this) } as const
  }

  swap16() {
    const buffer = new DataView(this.buffer, this.byteOffset, this.byteLength)
    for (let i = 0; i < this.length; i += 2) {
      buffer.setUint16(i, buffer.getUint16(i, true), false)
    }
    return this
  }

  swap32() {
    const buffer = new DataView(this.buffer, this.byteOffset, this.byteLength)
    for (let i = 0; i < this.length; i += 4) {
      buffer.setUint32(i, buffer.getUint32(i, true), false)
    }
    return this
  }

  swap64() {
    const view = new DataView(this.buffer, this.byteOffset, this.byteLength)
    for (let i = 0; i < this.length; i += 8) {
      view.setBigUint64(i, view.getBigUint64(i, true), false)
    }
    return this
  }

  compare(target: Uint8Array, start = 0, end = target.length, thisStart = 0, thisEnd = this.length) {
    return Buffer.compare(this.slice(thisStart, thisEnd), target.slice(start, end))
  }

  equals(target: Uint8Array) {
    return this.length === target.length && this.every((v, i) => v === target[i])
  }

  copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
    let copiedBytes = 0
    while (sourceStart < sourceEnd) {
      if (this[sourceStart] === undefined) break
      if (target[targetStart] === undefined) break

      target[targetStart] = this[sourceStart]
      copiedBytes++
      sourceStart++
      targetStart++
    }

    return copiedBytes
  }

  write(string: string, encoding?: Encoding): number
  write(string: string, offset: number, encoding?: Encoding): number
  write(string: string, offset: number, length: number, encoding?: Encoding): number
  write(string: string, offsetEnc?: number | Encoding, lengthEnc?: number | Encoding, encoding: Encoding = 'utf8') {
    const offset = typeof offsetEnc === 'string' ? 0 : offsetEnc ?? 0
    const length = typeof lengthEnc === 'string' ? this.length - offset : lengthEnc ?? this.length - offset
    encoding = typeof offsetEnc === 'string' ? offsetEnc : typeof lengthEnc === 'string' ? lengthEnc : encoding

    return stringToBuffer(string, encoding).copy(this, offset, 0, length)
  }

  fill(
    value: string | number | Uint8Array,
    offsetEnc: number | Encoding = 0,
    endEnc: number | Encoding = this.length,
    encoding: Encoding = 'utf-8',
  ) {
    const offset = typeof offsetEnc === 'string' ? 0 : offsetEnc
    const end = typeof endEnc === 'string' ? this.length : endEnc
    encoding = typeof offsetEnc === 'string' ? offsetEnc : typeof endEnc === 'string' ? endEnc : encoding
    value = Buffer.from(typeof value === 'number' ? [value] : value, encoding)

    if (value instanceof Uint8Array && value.length) {
      for (let i = offset; i < end; i += value.length) {
        super.set(value.slice(0, value.length + i >= this.length ? this.length - i : value.length), i)
      }
    }

    return this
  }

  includes(value: string | number | Uint8Array, byteOffset = 0, encoding: Encoding = 'utf-8') {
    return this.indexOf(value, byteOffset, encoding) !== -1
  }

  lastIndexOf(
    value: string | number | Uint8Array,
    byteOffsetOrEncoding: number | Encoding = 0,
    encoding: Encoding = 'utf-8',
  ) {
    return this.indexOf(value, byteOffsetOrEncoding, encoding, true)
  }

  indexOf(
    value: string | number | Uint8Array,
    byteOffsetOrEncoding: number | Encoding = 0,
    encoding: Encoding = 'utf-8',
    lastIndexOf = false,
  ) {
    const method = lastIndexOf ? 'findLastIndex' : 'findIndex'
    encoding = typeof byteOffsetOrEncoding === 'string' ? byteOffsetOrEncoding : encoding
    const toSearch = Buffer.from(typeof value === 'number' ? [value] : value, encoding)
    let byteOffset = typeof byteOffsetOrEncoding === 'string' ? 0 : byteOffsetOrEncoding
    byteOffset = byteOffset < 0 ? this.length + byteOffset : byteOffset

    if (toSearch.length === 0 && lastIndexOf === false) {
      return byteOffset >= this.length ? this.length : byteOffset
    }
    if (toSearch.length === 0 && lastIndexOf === true) {
      return (byteOffset >= this.length ? this.length : byteOffset) || this.length
    }

    return this[method]((_, i) => {
      const searchIf = lastIndexOf ? i <= (byteOffset || this.length) : i >= byteOffset
      return searchIf && this[i] === toSearch[0] && toSearch.every((val, j) => this[i + j] === val)
    })
  }

  toString(encoding: Encoding = 'utf8', start = 0, end = this.length) {
    start = start < 0 ? 0 : start
    encoding = encoding.toString().toLowerCase() as Encoding

    if (end <= 0) return ''

    if (encoding === 'utf8' || encoding === 'utf-8') {
      return decoder.decode(this.slice(start, end))
    }
    if (encoding === 'base64' || encoding === 'base64url') {
      const string = btoa(this.reduce((s, v) => s + c2s(v), ''))

      if (encoding === 'base64url') {
        return string.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      }

      return string
    }
    if (encoding === 'binary' || encoding === 'ascii' || encoding === 'latin1' || encoding === 'latin-1') {
      return this.slice(start, end).reduce((s, v) => s + c2s(v & (encoding === 'ascii' ? 0x7f : 0xff)), '')
    }
    if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
      let string = ''
      const view = new DataView(this.slice(start, end).buffer)
      for (let i = 0; i < view.byteLength; i += 2) {
        string += c2s(view.getUint16(i, true))
      }
      return string
    }
    if (encoding === 'hex') {
      return this.slice(start, end).reduce((s, v) => s + v.toString(16).padStart(2, '0'), '')
    }

    bufferPolyfillDoesNotImplement(`encoding "${encoding}"`)
  }

  toLocaleString() {
    return this.toString()
  }
}

function stringToBuffer(value: string, encoding: string) {
  encoding = encoding.toLowerCase() as Encoding

  if (encoding === 'utf8' || encoding === 'utf-8') {
    return new Buffer(encoder.encode(value))
  }
  if (encoding === 'base64' || encoding === 'base64url') {
    return new Buffer([...atob(value)].map((v) => v.charCodeAt(0)))
  }
  if (encoding === 'binary' || encoding === 'ascii' || encoding === 'latin1' || encoding === 'latin-1') {
    return new Buffer([...value].map((v) => v.charCodeAt(0)))
  }
  if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
    const buffer = new Buffer(value.length * 2)
    const view = new DataView(buffer.buffer)
    for (let i = 0; i < value.length; i++) {
      view.setUint16(i * 2, value.charCodeAt(i), true)
    }
    return buffer
  }
  if (encoding === 'hex') {
    const bytes = new Buffer(value.length / 2)
    for (let byteIndex = 0, i = 0; i < value.length; i += 2, byteIndex++) {
      bytes[byteIndex] = parseInt(value.slice(i, i + 2), 16)
    }

    return bytes
  }

  bufferPolyfillDoesNotImplement(`encoding "${encoding}"`)
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type Encoding =
  | 'utf8'
  | 'utf-8'
  | 'hex'
  | 'base64'
  | 'ascii'
  | 'binary'
  | 'base64url'
  | 'ucs2'
  | 'ucs-2'
  | 'utf16le'
  | 'utf-16le'
  | 'latin1'
  | 'latin-1'

function initReadMethods(prototype: Buffer) {
  const dataViewProtoProps = Object.getOwnPropertyNames(DataView.prototype)
  const dataViewMethods = dataViewProtoProps.filter((m) => m.startsWith('get') || m.startsWith('set'))
  const bufferBaseMethods = dataViewMethods.map((m) => m.replace('get', 'read').replace('set', 'write'))

  const genericReadMethod = (i: number, littleEndian: boolean) => {
    return function (this: Buffer, offset = 0) {
      return new DataView(this.buffer)[dataViewMethods[i]](offset, littleEndian)
    }
  }

  const genericWriteMethod = (i: number, littleEndian: boolean) => {
    return function (this: Buffer, value: any, offset = 0) {
      new DataView(this.buffer)[dataViewMethods[i]](offset, value, littleEndian)
      return offset + parseInt(dataViewMethods[i].match(/\d+/)![0]) / 8
    }
  }

  const createAlias = (methods: string[]) => {
    methods.forEach((method) => {
      if (method.includes('Uint')) prototype[method.replace('Uint', 'UInt')] = prototype[method]
      if (method.includes('Float64')) prototype[method.replace('Float64', 'Double')] = prototype[method]
      if (method.includes('Float32')) prototype[method.replace('Float32', 'Float')] = prototype[method]
    })
  }

  bufferBaseMethods.forEach((method, i) => {
    if (method.startsWith('read')) {
      prototype[method] = genericReadMethod(i, false)
      prototype[method + 'LE'] = genericReadMethod(i, true)
      prototype[method + 'BE'] = genericReadMethod(i, false)
    }
    if (method.startsWith('write')) {
      prototype[method] = genericWriteMethod(i, false)
      prototype[method + 'LE'] = genericWriteMethod(i, true)
      prototype[method + 'BE'] = genericWriteMethod(i, false)
    }
    createAlias([method, method + 'LE', method + 'BE'])
  })
}

function bufferPolyfillDoesNotImplement(message: string): never {
  throw new Error(`Buffer polyfill does not implement "${message}"`)
}

initReadMethods(Buffer.prototype)

const c2s = String.fromCodePoint
