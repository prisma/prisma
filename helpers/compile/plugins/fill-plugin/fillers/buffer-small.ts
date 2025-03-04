/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
export interface BufferClass {
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
  writeBigInt64BE(value: bigint, offset: number): number
  writeBigInt64BE(value: bigint, offset: number): number
  writeBigInt64LE(value: bigint, offset: number): number
  writeBigInt64LE(value: bigint, offset: number): number
  writeBigUint64BE(value: bigint, offset: number): number
  writeBigUInt64BE(value: bigint, offset: number): number
  writeBigUint64LE(value: bigint, offset: number): number
  writeBigUInt64LE(value: bigint, offset: number): number
  writeDoubleBE(value: number, offset: number): number
  writeDoubleLE(value: number, offset: number): number
  writeFloatBE(value: number, offset: number): number
  writeFloatLE(value: number, offset: number): number
  writeInt16BE(value: number, offset: number): number
  writeInt16LE(value: number, offset: number): number
  writeInt32BE(value: number, offset: number): number
  writeInt32LE(value: number, offset: number): number
  writeInt8(value: number, offset: number): number
  writeIntBE(value: number, offset: number, byteLength: number): number
  writeIntLE(value: number, offset: number, byteLength: number): number
  writeUint16BE(value: number, offset: number): number
  writeUInt16BE(value: number, offset: number): number
  writeUint16LE(value: number, offset: number): number
  writeUInt16LE(value: number, offset: number): number
  writeUint32BE(value: number, offset: number): number
  writeUInt32BE(value: number, offset: number): number
  writeUint32LE(value: number, offset: number): number
  writeUInt32LE(value: number, offset: number): number
  writeUint8(value: number, offset: number): number
  writeUInt8(value: number, offset: number): number
  writeUintBE(value: number, offset: number, byteLength: number): number
  writeUIntBE(value: number, offset: number, byteLength: number): number
  writeUintLE(value: number, offset: number, byteLength: number): number
  writeUIntLE(value: number, offset: number, byteLength: number): number
}

export class BufferClass extends Uint8Array /* implements NodeBuffer */ {
  readonly _isBuffer = true

  get offset() {
    return this.byteOffset
  }

  static alloc(size: number, fill: string | number | Uint8Array = 0, encoding: Encoding = 'utf8') {
    assertString(encoding, 'encoding')

    return BufferClass.allocUnsafe(size).fill(fill, encoding)
  }

  static allocUnsafe(size: number) {
    return BufferClass.from(size)
  }

  static allocUnsafeSlow(size: number) {
    return BufferClass.from(size)
  }

  static isBuffer(arg: any): arg is BufferClass {
    return arg && !!arg._isBuffer
  }

  static byteLength(string: unknown, encoding: Encoding = 'utf8') {
    if (typeof string === 'string') return stringToBuffer(string, encoding).byteLength
    if (string?.byteLength) return string.byteLength

    const e = new TypeError('The "string" argument must be of type string or an instance of Buffer or ArrayBuffer.')
    e.code = 'ERR_INVALID_ARG_TYPE'
    throw e
  }

  static isEncoding(encoding: string): encoding is Encoding {
    return Encodings.includes(encoding as any)
  }

  static compare(buff1: Uint8Array, buff2: Uint8Array) {
    assertUint8Array(buff1, 'buff1')
    assertUint8Array(buff2, 'buff2')

    for (let i = 0; i < buff1.length; i++) {
      if (buff1[i] < buff2[i]) return -1
      if (buff1[i] > buff2[i]) return 1
    }

    return buff1.length === buff2.length ? 0 : buff1.length > buff2.length ? 1 : -1
  }

  static from(value: unknown, encoding: any = 'utf8'): BufferClass {
    if (value && typeof value === 'object' && value.type === 'Buffer') {
      return new BufferClass(value.data)
    }

    if (typeof value === 'number') {
      return new BufferClass(new Uint8Array(value))
    }

    if (typeof value === 'string') {
      return stringToBuffer(value, encoding)
    }

    if (ArrayBuffer.isView(value)) {
      const { byteOffset, byteLength, buffer } = value

      if ('map' in value && typeof value.map === 'function') {
        return new BufferClass(
          value.map((v) => v % 256),
          byteOffset,
          byteLength,
        )
      }

      return new BufferClass(buffer, byteOffset, byteLength)
    }

    if (value && typeof value === 'object' && ('length' in value || 'byteLength' in value || 'buffer' in value)) {
      return new BufferClass(value as ArrayLike<number>)
    }

    throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
  }

  static concat(list: readonly Uint8Array[], totalLength?: number) {
    if (list.length === 0) return BufferClass.alloc(0)

    const concat = ([] as number[]).concat(...list.map((item) => [...item]))
    const result = BufferClass.alloc(totalLength !== undefined ? totalLength : concat.length)

    result.set(totalLength !== undefined ? concat.slice(0, totalLength) : concat)

    return result
  }

  slice(start = 0, end = this.length) {
    return this.subarray(start, end)
  }

  subarray(start = 0, end = this.length) {
    return Object.setPrototypeOf(super.subarray(start, end), BufferClass.prototype) as BufferClass
  }

  reverse() {
    super.reverse()

    return this
  }

  readIntBE(offset: number, byteLength: number) {
    assertNumber(offset, 'offset')
    assertInteger(offset, 'offset')
    assertUnsigned(offset, 'offset', this.length - 1)
    assertNumber(byteLength, 'byteLength')
    assertInteger(byteLength, 'byteLength')

    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val = val * 0x100 + view.getUint8(i)
    }

    if (view.getUint8(0) & 0x80) {
      val -= 0x100 ** byteLength
    }

    return val
  }

  readIntLE(offset: number, byteLength: number) {
    assertNumber(offset, 'offset')
    assertInteger(offset, 'offset')
    assertUnsigned(offset, 'offset', this.length - 1)
    assertNumber(byteLength, 'byteLength')
    assertInteger(byteLength, 'byteLength')

    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val += view.getUint8(i) * 0x100 ** i
    }

    if (view.getUint8(byteLength - 1) & 0x80) {
      val -= 0x100 ** byteLength
    }

    return val
  }

  readUIntBE(offset: number, byteLength: number) {
    assertNumber(offset, 'offset')
    assertInteger(offset, 'offset')
    assertUnsigned(offset, 'offset', this.length - 1)
    assertNumber(byteLength, 'byteLength')
    assertInteger(byteLength, 'byteLength')

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
    assertNumber(offset, 'offset')
    assertInteger(offset, 'offset')
    assertUnsigned(offset, 'offset', this.length - 1)
    assertNumber(byteLength, 'byteLength')
    assertInteger(byteLength, 'byteLength')

    const view = new DataView(this.buffer, offset, byteLength)
    let val = 0
    for (let i = 0; i < byteLength; i++) {
      val += view.getUint8(i) * 0x100 ** i
    }

    return val
  }

  readUintLE(offset: number, byteLength: number) {
    return this.readUIntLE(offset, byteLength)
  }

  writeIntBE(value: number, offset: number, byteLength: number) {
    value = value < 0 ? value + 0x100 ** byteLength : value
    return this.writeUIntBE(value, offset, byteLength)
  }

  writeIntLE(value: number, offset: number, byteLength: number) {
    value = value < 0 ? value + 0x100 ** byteLength : value
    return this.writeUIntLE(value, offset, byteLength)
  }

  writeUIntBE(value: number, offset: number, byteLength: number) {
    assertNumber(offset, 'offset')
    assertInteger(offset, 'offset')
    assertUnsigned(offset, 'offset', this.length - 1)
    assertNumber(byteLength, 'byteLength')
    assertInteger(byteLength, 'byteLength')

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
    assertNumber(offset, 'offset')
    assertInteger(offset, 'offset')
    assertUnsigned(offset, 'offset', this.length - 1)
    assertNumber(byteLength, 'byteLength')
    assertInteger(byteLength, 'byteLength')

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

  compare(target: Uint8Array, targetStart = 0, targetEnd = target.length, sourceStart = 0, sourceEnd = this.length) {
    assertUint8Array(target, 'target')
    assertNumber(targetStart, 'targetStart')
    assertNumber(targetEnd, 'targetEnd')
    assertNumber(sourceStart, 'sourceStart')
    assertNumber(sourceEnd, 'sourceEnd')
    assertUnsigned(targetStart, 'targetStart')
    assertUnsigned(targetEnd, 'targetEnd', target.length)
    assertUnsigned(sourceStart, 'sourceStart')
    assertUnsigned(sourceEnd, 'sourceEnd', this.length)

    return BufferClass.compare(this.slice(sourceStart, sourceEnd), target.slice(targetStart, targetEnd))
  }

  equals(otherBuffer: Uint8Array) {
    assertUint8Array(otherBuffer, 'otherBuffer')

    return this.length === otherBuffer.length && this.every((v, i) => v === otherBuffer[i])
  }

  copy(target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
    assertUnsigned(targetStart, 'targetStart')
    assertUnsigned(sourceStart, 'sourceStart', this.length)
    assertUnsigned(sourceEnd, 'sourceEnd')

    targetStart >>>= 0
    sourceStart >>>= 0
    sourceEnd >>>= 0

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
    let length = typeof lengthEnc === 'string' ? this.length - offset : lengthEnc ?? this.length - offset
    encoding = typeof offsetEnc === 'string' ? offsetEnc : typeof lengthEnc === 'string' ? lengthEnc : encoding

    assertNumber(offset, 'offset')
    assertNumber(length, 'length')
    assertUnsigned(offset, 'offset', this.length)
    assertUnsigned(length, 'length', this.length)

    if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
      length = length - (length % 2)
    }

    return stringToBuffer(string, encoding).copy(this, offset, 0, length)
  }

  fill(
    value: string | number | Uint8Array = 0,
    offsetEnc: number | Encoding = 0,
    endEnc: number | Encoding = this.length,
    encoding: Encoding = 'utf-8',
  ) {
    const offset = typeof offsetEnc === 'string' ? 0 : offsetEnc
    const end = typeof endEnc === 'string' ? this.length : endEnc
    encoding = typeof offsetEnc === 'string' ? offsetEnc : typeof endEnc === 'string' ? endEnc : encoding
    value = BufferClass.from(typeof value === 'number' ? [value] : value ?? [], encoding)

    assertString(encoding, 'encoding')
    assertUnsigned(offset, 'offset', this.length)
    assertUnsigned(end, 'end', this.length)

    if (value.length !== 0) {
      for (let i = offset; i < end; i += value.length) {
        super.set(value.slice(0, value.length + i >= this.length ? this.length - i : value.length), i)
      }
    }

    return this
  }

  includes(value: string | number | Uint8Array, byteOffset: number | null = null, encoding: Encoding = 'utf-8') {
    return this.indexOf(value, byteOffset, encoding) !== -1
  }

  lastIndexOf(
    value: string | number | Uint8Array,
    byteOffsetOrEncoding: number | Encoding | null = null,
    encoding: Encoding = 'utf-8',
  ) {
    return this.indexOf(value, byteOffsetOrEncoding, encoding, true)
  }

  indexOf(
    value: string | number | Uint8Array,
    byteOffsetOrEncoding: number | Encoding | null = null,
    encoding: Encoding = 'utf-8',
    lastIndexOf = false,
  ) {
    const method = lastIndexOf ? this.findLastIndex.bind(this) : this.findIndex.bind(this)
    encoding = typeof byteOffsetOrEncoding === 'string' ? byteOffsetOrEncoding : encoding
    const toSearch = BufferClass.from(typeof value === 'number' ? [value] : value, encoding)
    let byteOffset = typeof byteOffsetOrEncoding === 'string' ? 0 : byteOffsetOrEncoding
    byteOffset = typeof byteOffsetOrEncoding === 'number' ? byteOffset : null
    byteOffset = Number.isNaN(byteOffset) ? null : byteOffset
    byteOffset ??= lastIndexOf ? this.length : 0
    byteOffset = byteOffset < 0 ? this.length + byteOffset : byteOffset

    if (toSearch.length === 0 && lastIndexOf === false) {
      return byteOffset >= this.length ? this.length : byteOffset
    }
    if (toSearch.length === 0 && lastIndexOf === true) {
      return (byteOffset >= this.length ? this.length : byteOffset) || this.length
    }

    return method((_, i) => {
      const searchIf = lastIndexOf ? i <= byteOffset! : i >= byteOffset!
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
      const view = new DataView(this.buffer.slice(start, end))
      return Array.from({ length: view.byteLength / 2 }, (_, i) => {
        // if the byte length is odd, the last character will be ignored
        return i * 2 + 1 < view.byteLength ? c2s(view.getUint16(i * 2, true)) : ''
      }).join('')
    }
    if (encoding === 'hex') {
      return this.slice(start, end).reduce((s, v) => s + v.toString(16).padStart(2, '0'), '')
    }

    bufferPolyfillDoesNotImplement(`encoding "${encoding}"`)
  }

  toLocaleString() {
    return this.toString()
  }

  inspect() {
    const hex = this.toString('hex')
    const byteHex = hex.match(/.{1,2}/g)!.join(' ')

    return `<Buffer ${byteHex}>`
  }
}

function stringToBuffer(value: string, encoding: string) {
  encoding = encoding.toLowerCase() as Encoding

  if (encoding === 'utf8' || encoding === 'utf-8') {
    return new BufferClass(encoder.encode(value))
  }
  if (encoding === 'base64' || encoding === 'base64url') {
    value = value.replace(/-/g, '+').replace(/_/g, '/')
    value = value.replace(/[^A-Za-z0-9+/]/g, '')

    return new BufferClass([...atob(value)].map((v) => v.charCodeAt(0)))
  }
  if (encoding === 'binary' || encoding === 'ascii' || encoding === 'latin1' || encoding === 'latin-1') {
    return new BufferClass([...value].map((v) => v.charCodeAt(0)))
  }
  if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
    const buffer = new BufferClass(value.length * 2)
    const view = new DataView(buffer.buffer)
    for (let i = 0; i < value.length; i++) {
      view.setUint16(i * 2, value.charCodeAt(i), true)
    }
    return buffer
  }
  if (encoding === 'hex') {
    const bytes = new BufferClass(value.length / 2)
    for (let byteIndex = 0, i = 0; i < value.length; i += 2, byteIndex++) {
      bytes[byteIndex] = Number.parseInt(value.slice(i, i + 2), 16)
    }

    return bytes
  }

  bufferPolyfillDoesNotImplement(`encoding "${encoding}"`)
}

function initReadMethods(prototype: BufferClass) {
  const dataViewProtoProps = Object.getOwnPropertyNames(DataView.prototype)
  const dataViewMethods = dataViewProtoProps.filter((m) => m.startsWith('get') || m.startsWith('set'))
  const bufferBaseMethods = dataViewMethods.map((m) => m.replace('get', 'read').replace('set', 'write'))

  const genericReadMethod = (i: number, littleEndian: boolean) => {
    return function (this: BufferClass, offset = 0) {
      assertNumber(offset, 'offset')
      assertInteger(offset, 'offset')
      assertUnsigned(offset, 'offset', this.length - 1)
      return new DataView(this.buffer)[dataViewMethods[i]](offset, littleEndian)
    }
  }

  const genericWriteMethod = (i: number, littleEndian: boolean) => {
    return function (this: BufferClass, value: any, offset = 0) {
      const boundKey = dataViewMethods[i].match(/set(\w+\d+)/)![1].toLowerCase()
      const bound = bounds[boundKey as keyof typeof bounds]

      assertNumber(offset, 'offset')
      assertInteger(offset, 'offset')
      assertUnsigned(offset, 'offset', this.length - 1)
      assertBounds(value, 'value', bound[0], bound[1])
      new DataView(this.buffer)[dataViewMethods[i]](offset, value, littleEndian)
      return offset + Number.parseInt(dataViewMethods[i].match(/\d+/)![0]) / 8
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
      prototype[`${method}LE`] = genericReadMethod(i, true)
      prototype[`${method}BE`] = genericReadMethod(i, false)
    }
    if (method.startsWith('write')) {
      prototype[method] = genericWriteMethod(i, false)
      prototype[`${method}LE`] = genericWriteMethod(i, true)
      prototype[`${method}BE`] = genericWriteMethod(i, false)
    }
    createAlias([method, `${method}LE`, `${method}BE`])
  })
}

function bufferPolyfillDoesNotImplement(message: string): never {
  throw new Error(`Buffer polyfill does not implement "${message}"`)
}

function assertUint8Array(value: any, argName: string): asserts value is Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError(`The "${argName}" argument must be an instance of Buffer or Uint8Array`)
  }
}

function assertUnsigned(value: number, argName: string, maxValue = MAX_UNSIGNED_32_BIT + 1) {
  if (value < 0 || value > maxValue) {
    const e = new RangeError(
      `The value of "${argName}" is out of range. It must be >= 0 && <= ${maxValue}. Received ${value}`,
    )
    e.code = 'ERR_OUT_OF_RANGE'
    throw e
  }
}

function assertNumber(value: any, argName: string): asserts value is number {
  if (typeof value !== 'number') {
    const e = new TypeError(`The "${argName}" argument must be of type number. Received type ${typeof value}.`)
    e.code = 'ERR_INVALID_ARG_TYPE'
    throw e
  }
}

function assertInteger(value: any, argName: string): asserts value is number {
  if (!Number.isInteger(value) || Number.isNaN(value)) {
    const e = new RangeError(`The value of "${argName}" is out of range. It must be an integer. Received ${value}`)
    e.code = 'ERR_OUT_OF_RANGE'
    throw e
  }
}

function assertBounds(value: number, argName: string, min: any, max: any) {
  if (value < min || value > max) {
    const e = new RangeError(
      `The value of "${argName}" is out of range. It must be >= ${min} and <= ${max}. Received ${value}`,
    )
    e.code = 'ERR_OUT_OF_RANGE'
    throw e
  }
}

function assertString(value: any, argName: string): asserts value is string {
  if (typeof value !== 'string') {
    const e = new TypeError(`The "${argName}" argument must be of type string. Received type ${typeof value}`)
    e.code = 'ERR_INVALID_ARG_TYPE'
    throw e
  }
}

const bounds = {
  int8: [-0x80, 0x7f],
  int16: [-0x8000, 0x7fff],
  int32: [-0x80000000, 0x7fffffff],
  uint8: [0, 0xff],
  uint16: [0, 0xffff],
  uint32: [0, 0xffffffff],
  float32: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
  float64: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
  bigint64: [-0x8000000000000000n, 0x7fffffffffffffffn],
  biguint64: [0n, 0xffffffffffffffffn],
} as const

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type Encoding = (typeof Encodings)[number]

const Encodings = [
  'utf8',
  'utf-8',
  'hex',
  'base64',
  'ascii',
  'binary',
  'base64url',
  'ucs2',
  'ucs-2',
  'utf16le',
  'utf-16le',
  'latin1',
  'latin-1',
] as const

const MAX_UNSIGNED_32_BIT = 0xffffffff

initReadMethods(BufferClass.prototype)

function $Buffer(value: unknown, encoding: any = 'utf8') {
  return BufferClass.from(value, encoding)
}

export const Buffer = new Proxy($Buffer, {
  construct(_, [value, encoding]) {
    return BufferClass.from(value, encoding)
  },
  get(_, prop) {
    return BufferClass[prop]
  },
}) as typeof $Buffer & typeof BufferClass

const c2s = String.fromCodePoint
