/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

exports.Buffer = B
exports.INSPECT_MAX_BYTES = 50

const K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * Not used internally, but exported to maintain api compatability
 * Uses 32-bit implementation value from Node defined in String:kMaxLength
 *
 * @see https://github.com/nodejs/node/blob/main/deps/v8/include/v8-primitive.h#L126
 * @see https://github.com/nodejs/node/blob/main/src/node_buffer.cc#L1298
 * @see https://github.com/nodejs/node/blob/main/lib/buffer.js#L142
 */
const K_STRING_MAX_LENGTH = (1 << 28) - 16
exports.kStringMaxLength = K_STRING_MAX_LENGTH

exports.constants = {
  MAX_LENGTH: K_MAX_LENGTH,
  MAX_STRING_LENGTH: K_STRING_MAX_LENGTH,
}

function createBuffer(length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('')
  }
  // Return an augmented `Uint8Array` instance
  const buf = new Uint8Array(length)
  Object.setPrototypeOf(buf, B.prototype)
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `B.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function B(arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError('')
    }
    return createBuffer(arg)
  }
  return from(arg, encodingOrOffset, length)
}

B.poolSize = 8192 // not used by this implementation

function from(value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayView(value)
  }

  if (value == null) {
    throw new TypeError('')
  }

  if (isInstance(value, ArrayBuffer) || (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (
    typeof SharedArrayBuffer !== 'undefined' &&
    (isInstance(value, SharedArrayBuffer) || (value && isInstance(value.buffer, SharedArrayBuffer)))
  ) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError('')
  }

  const valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return B.from(valueOf, encodingOrOffset, length)
  }

  const b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === 'function') {
    return B.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length)
  }

  throw new TypeError('')
}

function fromString(string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  const length = byteLength(string, encoding) | 0
  let buf = createBuffer(length)

  const actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * B.from(str[, encoding])
 * B.from(array)
 * B.from(buffer)
 * B.from(arrayBuffer[, byteOffset[, length]])
 **/
B.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* B.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Object.setPrototypeOf(B.prototype, Uint8Array.prototype)
Object.setPrototypeOf(B, Uint8Array)

function fromArrayLike(array) {
  const length = array.length < 0 ? 0 : checked(array.length) | 0
  const buf = createBuffer(length)
  for (let i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayView(arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    const copy = new Uint8Array(arrayView)
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  }
  return fromArrayLike(arrayView)
}

function fromArrayBuffer(array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('')
  }

  let buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(buf, B.prototype)

  return buf
}

function fromObject(obj) {
  if (B.isBuffer(obj)) {
    const len = checked(obj.length) | 0
    const buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked(length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('')
  }
  return length | 0
}
B.concat = function concat(list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('')
  }

  if (list.length === 0) {
    return B.alloc(0)
  }

  let i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  const buffer = B.allocUnsafe(length)
  let pos = 0
  for (i = 0; i < list.length; ++i) {
    let buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      if (pos + buf.length > buffer.length) {
        if (!B.isBuffer(buf)) {
          buf = B.from(buf.buffer, buf.byteOffset, buf.byteLength)
        }
        buf.copy(buffer, pos)
      } else {
        Uint8Array.prototype.set.call(buffer, buf, pos)
      }
    } else if (!B.isBuffer(buf)) {
      throw new TypeError('')
    } else {
      buf.copy(buffer, pos)
    }
    pos += buf.length
  }
  return buffer
}

function byteLength(string, encoding) {
  if (B.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError('')
  }

  const len = string.length
  const mustMatch = arguments.length > 2 && arguments[2] === true
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
B.byteLength = byteLength

function slowToString(encoding, start, end) {
  let loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  // eslint-disable-next-line no-constant-condition
  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

const $ = B.prototype

// This property is used by `B.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
$._isBuffer = true

B.isBuffer = function isBuffer(b) {
  return b != null && b._isBuffer === true
}

function assertSize(size) {
  if (typeof size !== 'number') {
    throw new TypeError('')
  } else if (size < 0) {
    throw new RangeError('')
  }
}

function alloc(size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpreted as a start offset.
    return typeof encoding === 'string' ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
B.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe(size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
B.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
B.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function swap(b, n, m) {
  const i = b[n]
  b[n] = b[m]
  b[m] = i
}

$.swap16 = function swap16() {
  const len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('')
  }
  for (let i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

$.swap32 = function swap32() {
  const len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('')
  }
  for (let i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

$.swap64 = function swap64() {
  const len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('')
  }
  for (let i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

$.toString = function toString() {
  const length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

$.toLocaleString = $.toString

$.equals = function equals(b) {
  if (!B.isBuffer(b)) throw new TypeError('')
  if (this === b) return true
  return this.compare(b) === 0
}

$.inspect = function inspect() {
  let str = ''
  const max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max)
    .replace(/(.{2})/g, '$1 ')
    .trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}
B.prototype[Symbol.for('nodejs.util.inspect.custom')] = $.inspect

$.compare = function compare(target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = B.from(target, target.offset, target.byteLength)
  }
  if (!B.isBuffer(target)) {
    throw new TypeError('')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  let x = thisEnd - thisStart
  let y = end - start
  const len = Math.min(x, y)

  const thisCopy = this.slice(thisStart, thisEnd)
  const targetCopy = target.slice(start, end)

  for (let i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : buffer.length - 1
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = B.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (B.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xff // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
  }

  throw new TypeError('')
}

function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  let indexSize = 1
  let arrLength = arr.length
  let valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read(buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  let i
  if (dir) {
    let foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      let found = true
      for (let j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

$.includes = function includes(val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

$.indexOf = function indexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

$.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0
  const remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  const strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  let i
  for (i = 0; i < length; ++i) {
    const a = hexCharValueTable[string[i * 2]]
    const b = hexCharValueTable[string[i * 2 + 1]]
    if (a === undefined || b === undefined) {
      return i
    }
    buf[offset + i] = (a << 4) | b
  }
  return i
}

function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

$.write = function write(string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
    // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
    // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error('')
  }

  const remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('')
  }

  if (!encoding) encoding = 'utf8'

  let loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
      case 'latin1':
      case 'binary':
        return asciiWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

$.toJSON = function toJSON() {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0),
  }
}

function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length) {
    return btoa(String.fromCharCode(...buf))
  } else {
    return btoa(String.fromCharCode(...buf.slice(start, end)))
  }
}

function utf8Slice(buf, start, end) {
  return new TextDecoder().decode(buf.slice(start, end))
}

function asciiSlice(buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7f)
  }
  return ret
}

function latin1Slice(buf, start, end) {
  let ret = ''
  end = Math.min(buf.length, end)

  for (let i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice(buf, start, end) {
  const len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  let out = ''
  for (let i = start; i < end; ++i) {
    out += hexSliceLookupTable[buf[i]]
  }
  return out
}

function utf16leSlice(buf, start, end) {
  const bytes = buf.slice(start, end)
  let res = ''
  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  for (let i = 0; i < bytes.length - 1; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

$.slice = function slice(start, end) {
  const len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  const newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  Object.setPrototypeOf(newBuf, B.prototype)

  return newBuf
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
$.copy = function copy(target, targetStart, start, end) {
  if (!B.isBuffer(target)) throw new TypeError('')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('')
  }
  if (start < 0 || start >= this.length) throw new RangeError('')
  if (end < 0) throw new RangeError('')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  const len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else {
    Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart)
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
$.fill = function fill(val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('')
    }

    if (val.length === 1) {
      const code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) || encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  } else if (typeof val === 'boolean') {
    val = Number(val)
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  let i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    const bytes = B.isBuffer(val) ? val : B.from(val, encoding)
    const len = bytes.length
    if (len === 0) {
      throw new TypeError('')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

$.readBigInt64BE = function readBigInt64BE(offset = 0) {
  return new DataView(this.buffer).getBigInt64(offset, false)
}

$.readBigInt64LE = function readBigInt64LE(offset = 0) {
  return new DataView(this.buffer).getBigInt64(offset, true)
}

$.readBigUInt64BE = function readBigUInt64BE(offset = 0) {
  return new DataView(this.buffer).getBigUint64(offset, false)
}

$.readBigUInt64LE = function readBigUInt64LE(offset = 0) {
  return new DataView(this.buffer).getBigUint64(offset, true)
}

$.readDoubleBE = function readDoubleBE(offset = 0) {
  return new DataView(this.buffer).getFloat64(offset, false)
}

$.readDoubleLE = function readDoubleLE(offset = 0) {
  return new DataView(this.buffer).getFloat64(offset, true)
}

$.readFloatBE = function readFloatBE(offset = 0) {
  return new DataView(this.buffer).getFloat32(offset, false)
}

$.readFloatLE = function readFloatLE(offset = 0) {
  return new DataView(this.buffer).getFloat32(offset, true)
}

$.readInt8 = function readInt8(offset = 0) {
  return new DataView(this.buffer).getInt8(offset)
}

$.readInt16BE = function readInt16BE(offset = 0) {
  return new DataView(this.buffer).getInt16(offset, false)
}

$.readInt16LE = function readInt16LE(offset = 0) {
  return new DataView(this.buffer).getInt16(offset, true)
}

$.readInt32BE = function readInt32BE(offset = 0) {
  return new DataView(this.buffer).getInt32(offset, false)
}

$.readInt32LE = function readInt32LE(offset = 0) {
  return new DataView(this.buffer).getInt32(offset, true)
}

$.readUint8 = function readUint8(offset = 0) {
  return this.readUInt8(offset)
}

$.readUint16BE = function readUint16BE(offset = 0) {
  return this.readUInt16BE(offset)
}

$.readUint16LE = function readUint16LE(offset = 0) {
  return this.readUInt16LE(offset)
}

$.readUint32BE = function readUint32BE(offset = 0) {
  return this.readUInt32BE(offset)
}

$.readUint32LE = function readUint32LE(offset = 0) {
  return this.readUInt32LE(offset)
}

$.readUInt8 = function readUInt8(offset = 0) {
  return new DataView(this.buffer).getUint8(offset)
}

$.readUInt16BE = function readUInt16BE(offset = 0) {
  return new DataView(this.buffer).getUint16(offset, false)
}

$.readUInt16LE = function readUInt16LE(offset = 0) {
  return new DataView(this.buffer).getUint16(offset, true)
}

$.readUInt32BE = function readUInt32BE(offset = 0) {
  return new DataView(this.buffer).getUint32(offset, false)
}

$.readUInt32LE = function readUInt32LE(offset = 0) {
  return new DataView(this.buffer).getUint32(offset, true)
}

$.readBigUint64BE = function readBigUint64BE(offset = 0) {
  return this.readBigUInt64BE(offset)
}

$.readBigUint64LE = function readBigUint64LE(offset = 0) {
  return this.readBigUInt64LE(offset)
}

$.readIntBE = function readIntBE(offset, byteLength) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0

  let i = byteLength
  let mul = 1
  let val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

$.readIntLE = function readIntLE(offset, byteLength) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

$.readUIntBE = function readUIntBE(offset, byteLength) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0

  let val = this[offset + --byteLength]
  let mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

$.readUintBE = function readUintBE(offset, byteLength) {
  return this.readUIntBE(offset, byteLength)
}

$.readUIntLE = function readUIntLE(offset, byteLength) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0

  let val = this[offset]
  let mul = 1
  let i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

$.readUintLE = function readUintLE(offset, byteLength) {
  return this.readUIntLE(offset, byteLength)
}

$.writeBigInt64BE = function writeBigInt64BE(value, offset = 0) {
  new DataView(this.buffer).setBigInt64(offset, value, false)

  return offset + 8
}

$.writeBigInt64LE = function writeBigInt64LE(value, offset = 0) {
  new DataView(this.buffer).setBigInt64(offset, value, true)

  return offset + 8
}

$.writeBigUInt64BE = function writeBigUInt64BE(value, offset = 0) {
  new DataView(this.buffer).setBigUint64(offset, value, false)

  return offset + 8
}

$.writeBigUInt64LE = function writeBigUInt64LE(value, offset = 0) {
  new DataView(this.buffer).setBigUint64(offset, value, true)

  return offset + 8
}

$.writeDoubleBE = function writeDoubleBE(value, offset = 0) {
  new DataView(this.buffer).setFloat64(offset, value, false)

  return offset + 8
}

$.writeDoubleLE = function writeDoubleLE(value, offset = 0) {
  new DataView(this.buffer).setFloat64(offset, value, true)

  return offset + 8
}

$.writeFloatBE = function writeFloatBE(value, offset = 0) {
  new DataView(this.buffer).setFloat32(offset, value, false)

  return offset + 4
}

$.writeFloatLE = function writeFloatLE(value, offset = 0) {
  new DataView(this.buffer).setFloat32(offset, value, true)

  return offset + 4
}

$.writeInt8 = function writeInt8(value, offset = 0) {
  new DataView(this.buffer).setInt8(offset, value)

  return offset + 1
}

$.writeInt16BE = function writeInt16BE(value, offset = 0) {
  new DataView(this.buffer).setInt16(offset, value, false)

  return offset + 2
}

$.writeInt16LE = function writeInt16LE(value, offset = 0) {
  new DataView(this.buffer).setInt16(offset, value, true)

  return offset + 2
}

$.writeInt32BE = function writeInt32BE(value, offset = 0) {
  new DataView(this.buffer).setInt32(offset, value, false)

  return offset + 4
}

$.writeInt32LE = function writeInt32LE(value, offset = 0) {
  new DataView(this.buffer).setInt32(offset, value, true)

  return offset + 4
}

$.writeUInt8 = function writeUInt8(value, offset = 0) {
  new DataView(this.buffer).setUint8(offset, value)

  return offset + 1
}

$.writeUInt16BE = function writeUInt16BE(value, offset = 0) {
  new DataView(this.buffer).setUint16(offset, value, false)

  return offset + 2
}

$.writeUInt16LE = function writeUInt16LE(value, offset = 0) {
  new DataView(this.buffer).setUint16(offset, value, true)

  return offset + 2
}

$.writeUInt32BE = function writeUInt32BE(value, offset = 0) {
  new DataView(this.buffer).setUint32(offset, value, false)

  return offset + 4
}

$.writeUInt32LE = function writeUInt32LE(value, offset = 0) {
  new DataView(this.buffer).setUint32(offset, value, true)

  return offset + 4
}

$.writeIntBE = function writeIntBE(value, offset, byteLength) {
  value = +value
  offset = offset >>> 0

  let i = byteLength - 1
  let mul = 1
  let sub = 0
  this[offset + i] = value & 0xff
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = (((value / mul) >> 0) - sub) & 0xff
  }

  return offset + byteLength
}

$.writeIntLE = function writeIntLE(value, offset, byteLength) {
  value = +value
  offset = offset >>> 0

  let i = 0
  let mul = 1
  let sub = 0
  this[offset] = value & 0xff
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = (((value / mul) >> 0) - sub) & 0xff
  }

  return offset + byteLength
}

$.writeUIntBE = function writeUIntBE(value, offset, byteLength) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0

  let i = byteLength - 1
  let mul = 1
  this[offset + i] = value
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) >>> 0
  }

  return offset + byteLength
}

$.writeUintBE = function writeUintBE(value, offset, byteLength) {
  return this.writeUIntBE(value, offset, byteLength)
}

$.writeUIntLE = function writeUIntLE(value, offset, byteLength) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0

  let mul = 1
  let i = 0
  this[offset] = value & 0xff
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xff
  }

  return offset + byteLength
}

// HELPER FUNCTIONS
// ================

function utf8ToBytes(string) {
  return new TextEncoder().encode(string)
}

function asciiToBytes(str) {
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xff)
  }
  return byteArray
}

function utf16leToBytes(str, units) {
  let c, hi, lo
  const byteArray = []
  for (let i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes(str) {
  return new Uint8Array(
    atob(str)
      .split('')
      .map((c) => c.charCodeAt(0)),
  )
}

function blitBuffer(src, dst, offset, length) {
  let i
  for (i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance(obj, type) {
  return (
    obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name)
  )
}
function numberIsNaN(obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

// Create lookup table for `toString('hex')`
// See: https://github.com/feross/buffer/issues/219
const hexSliceLookupTable = (function () {
  const alphabet = '0123456789abcdef'
  const table = new Array(256)
  for (let i = 0; i < 16; ++i) {
    const i16 = i * 16
    for (let j = 0; j < 16; ++j) {
      table[i16 + j] = alphabet[i] + alphabet[j]
    }
  }
  return table
})()

// hex lookup table for B.from(x, 'hex')
const hexCharValueTable = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  a: 10,
  b: 11,
  c: 12,
  d: 13,
  e: 14,
  f: 15,
  A: 10,
  B: 11,
  C: 12,
  D: 13,
  E: 14,
  F: 15,
}
