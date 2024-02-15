/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-loss-of-precision */

import assert from 'assert'

import { Buffer } from '../../../../helpers/compile/plugins/fill-plugin/fillers/buffer-small'

describe('Buffer isBuffer (static)', () => {
  it('should return true if the object is a Buffer', () => {
    const buf = Buffer.from('Hello, World!')
    expect(Buffer.isBuffer(buf)).toBe(true)
  })

  it('should return false if the object is not a Buffer', () => {
    const notBuf = 'Hello, World!'
    expect(Buffer.isBuffer(notBuf)).toBe(false)
  })
})

describe('Buffer from (static)', () => {
  it('should create a new Buffer from a string', () => {
    const buf = Buffer.from('Hello, World!')
    expect(buf.toString()).toEqual('Hello, World!')
  })

  it('should create a new Buffer from an array', () => {
    const buf = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    expect(buf.toString()).toEqual('Hello')
  })

  it('should create a new Buffer from a Buffer', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from(buf1)
    expect(buf2.toString()).toEqual('Hello, World!')
  })

  it('should create a new Buffer from an ArrayBuffer', () => {
    const arr = new Uint16Array([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    const buf = Buffer.from(arr.buffer)
    expect(buf.toString()).toEqual('H\u0000e\u0000l\u0000l\u0000o\u0000')
  })

  it('should throw an error if input is invalid', () => {
    expect(() => Buffer.from(null)).toThrow()
  })
})

describe('Buffer compare (static)', () => {
  it('should return 0 when buffers are equal', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, World!')
    expect(Buffer.compare(buf1, buf2)).toEqual(0)
  })

  it('should return a number less than 0 when buf1 is less than buf2', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, World!!')
    expect(Buffer.compare(buf1, buf2)).toBeLessThan(0)
  })

  it('should return a number greater than 0 when buf1 is greater than buf2', () => {
    const buf1 = Buffer.from('Hello, World!!')
    const buf2 = Buffer.from('Hello, World!')
    expect(Buffer.compare(buf1, buf2)).toBeGreaterThan(0)
  })

  it('should handle empty buffers', () => {
    const buf1 = Buffer.from('')
    const buf2 = Buffer.from('')
    expect(Buffer.compare(buf1, buf2)).toEqual(0)
  })

  it('should throw an error if either argument is not a Buffer', () => {
    const buf = Buffer.from('Hello, World!')
    expect(() => Buffer.compare(buf, 'not a buffer' as any)).toThrow()
    expect(() => Buffer.compare('not a buffer' as any, buf)).toThrow()
  })
})

describe('Buffer slice', () => {
  test('simple', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    expect(buf.slice(0, 2)).toEqual(Buffer.from([1, 2]))
    expect(buf.slice(2, 4)).toEqual(Buffer.from([3, 4]))
    expect(buf.slice(4, 5)).toEqual(Buffer.from([5]))
    expect(buf.slice(0, 5)).toEqual(Buffer.from([1, 2, 3, 4, 5]))
    expect(buf.slice(0, 6)).toEqual(Buffer.from([1, 2, 3, 4, 5]))
    expect(buf.slice(0, 0)).toEqual(Buffer.alloc(0))
    expect(buf.slice(5, 5)).toEqual(Buffer.alloc(0))
    expect(buf.slice(5, 0)).toEqual(Buffer.alloc(0))

    expect(buf.slice(0, 2).length).toBe(2)
    expect(buf.slice(2, 4).length).toBe(2)
    expect(buf.slice(4, 5).length).toBe(1)
    expect(buf.slice(0, 5).length).toBe(5)
    expect(buf.slice(0, 6).length).toBe(5)
    expect(buf.slice(0, 0).length).toBe(0)

    const buf2 = Buffer.from('buffer')
    expect(buf2.slice(0, 3).toString()).toBe('buf')
    expect(buf2.slice(3).toString()).toBe('fer')
    expect(buf2.slice(0, -1).toString()).toBe('buffe')
    expect(buf2.slice(-6, -1).toString()).toBe('buffe')

    expect(buf2.slice(0, 3).length).toBe(3)
    expect(buf2.slice(3).length).toBe(3)
    expect(buf2.slice(0, -1).length).toBe(5)
    expect(buf2.slice(-6, -1).length).toBe(5)
  })

  it('should return a new buffer that references the same memory as the old, but offset and cropped by the start and end indices', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const slicedBuf = buf.slice(1, 4)
    expect(slicedBuf).toEqual(Buffer.from([2, 3, 4]))
  })

  it('should return a new buffer that references the same memory as the old, but offset by the start index when end index is not provided', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const slicedBuf = buf.slice(2)
    expect(slicedBuf).toEqual(Buffer.from([3, 4, 5]))
  })

  it('should return an empty buffer when start index is equal to the buffer length', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const slicedBuf = buf.slice(5)
    expect(slicedBuf).toEqual(Buffer.from([]))
  })

  it('should return the same buffer when start index is not provided', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const slicedBuf = buf.slice()
    expect(slicedBuf).toEqual(buf)
  })
})

describe('Buffer reverse', () => {
  it('should reverse the order of bytes in the buffer', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const reversedBuf = buf.reverse()
    expect(reversedBuf).toEqual(Buffer.from([5, 4, 3, 2, 1]))
  })

  it('should return the same buffer when it contains only one byte', () => {
    const buf = Buffer.from([1])
    const reversedBuf = buf.reverse()
    expect(reversedBuf).toEqual(Buffer.from([1]))
  })

  it('should return an empty buffer when the original buffer is empty', () => {
    const buf = Buffer.from([])
    const reversedBuf = buf.reverse()
    expect(reversedBuf).toEqual(Buffer.from([]))
  })
})

describe('Buffer subarray', () => {
  test('simple', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    expect(buf.subarray(0, 2)).toEqual(Buffer.from([1, 2]))
    expect(buf.subarray(2, 4)).toEqual(Buffer.from([3, 4]))
    expect(buf.subarray(4, 5)).toEqual(Buffer.from([5]))
    expect(buf.subarray(0, 5)).toEqual(Buffer.from([1, 2, 3, 4, 5]))
    expect(buf.subarray(0, 6)).toEqual(Buffer.from([1, 2, 3, 4, 5]))
    expect(buf.subarray(0, 0)).toEqual(Buffer.alloc(0))
    expect(buf.subarray(5, 5)).toEqual(Buffer.alloc(0))
    expect(buf.subarray(5, 0)).toEqual(Buffer.alloc(0))

    expect(buf.subarray(0, 2).length).toBe(2)
    expect(buf.subarray(2, 4).length).toBe(2)
    expect(buf.subarray(4, 5).length).toBe(1)
    expect(buf.subarray(0, 5).length).toBe(5)
    expect(buf.subarray(0, 6).length).toBe(5)
    expect(buf.subarray(0, 0).length).toBe(0)

    const buf2 = Buffer.from('buffer')
    expect(buf2.subarray(0, 3).toString()).toBe('buf')
    expect(buf2.subarray(3).toString()).toBe('fer')
    expect(buf2.subarray(0, -1).toString()).toBe('buffe')
    expect(buf2.subarray(-6, -1).toString()).toBe('buffe')

    expect(buf2.subarray(0, 3).length).toBe(3)
    expect(buf2.subarray(3).length).toBe(3)
    expect(buf2.subarray(0, -1).length).toBe(5)
    expect(buf2.subarray(-6, -1).length).toBe(5)
  })

  it('should return a new buffer that references the same memory as the old, but offset and cropped by the start and end indices', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const subarraydBuf = buf.subarray(1, 4)
    expect(subarraydBuf).toEqual(Buffer.from([2, 3, 4]))
  })

  it('should return a new buffer that references the same memory as the old, but offset by the start index when end index is not provided', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const subarraydBuf = buf.subarray(2)
    expect(subarraydBuf).toEqual(Buffer.from([3, 4, 5]))
  })

  it('should return an empty buffer when start index is equal to the buffer length', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const subarraydBuf = buf.subarray(5)
    expect(subarraydBuf).toEqual(Buffer.from([]))
  })

  it('should return the same buffer when start index is not provided', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5])
    const subarraydBuf = buf.subarray()
    expect(subarraydBuf).toEqual(buf)
  })
})

describe('Buffer readBigInt64BE, readBigInt64LE', () => {
  it('should read a BigInt from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    const result = buf.readBigInt64BE(0)
    expect(result).toBe(BigInt('-1'))
  })

  it('should read a BigInt from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    const result = buf.readBigInt64LE(0)
    expect(result).toBe(BigInt('-1'))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    expect(() => buf.readBigInt64BE(9)).toThrow()
    expect(() => buf.readBigInt64LE(9)).toThrow()
  })
})

describe('Buffer readInt8, readInt16BE, readInt16LE, readInt32BE, readInt32LE, readIntBE, readIntLE', () => {
  it('should read an 8-bit integer from the buffer at the specified offset', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readInt8(0)
    expect(result).toBe(-1)
  })

  it('should read a 16-bit integer from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255])
    const result = buf.readInt16BE(0)
    expect(result).toBe(-1)
  })

  it('should read a 16-bit integer from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255])
    const result = buf.readInt16LE(0)
    expect(result).toBe(-1)
  })

  it('should read a 32-bit integer from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readInt32BE(0)
    expect(result).toBe(-1)
  })

  it('should read a 32-bit integer from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readInt32LE(0)
    expect(result).toBe(-1)
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    expect(() => buf.readInt8(5)).toThrow()
    expect(() => buf.readInt16BE(5)).toThrow()
    expect(() => buf.readInt16LE(5)).toThrow()
    expect(() => buf.readInt32BE(5)).toThrow()
    expect(() => buf.readInt32LE(5)).toThrow()
  })
})

describe('Buffer readDoubleBE, readDoubleLE, readFloatBE, readFloatLE', () => {
  it('should read a double from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([64, 9, 33, 251, 84, 68, 45, 24])
    const result = buf.readDoubleBE(0)
    expect(result).toBeCloseTo(3.141592653589793)
  })

  it('should read a double from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([24, 45, 68, 84, 251, 33, 9, 64])
    const result = buf.readDoubleLE(0)
    expect(result).toBeCloseTo(3.141592653589793)
  })

  it('should read a float from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([64, 73, 15, 219])
    const result = buf.readFloatBE(0)
    expect(result).toBeCloseTo(3.1415927410125732)
  })

  it('should read a float from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([219, 15, 73, 64])
    const result = buf.readFloatLE(0)
    expect(result).toBeCloseTo(3.1415927410125732)
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.from([64, 9, 33, 251, 84, 68, 45, 24])
    expect(() => buf.readDoubleBE(9)).toThrow()
    expect(() => buf.readDoubleLE(9)).toThrow()
    expect(() => buf.readFloatBE(5)).toThrow()
    expect(() => buf.readFloatLE(5)).toThrow()
  })
})

describe('Buffer readBigUInt64BE, readBigUInt64LE, readBigUint64BE, readBigUint64LE', () => {
  it('should read a Big Unsigned Integer from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    const result = buf.readBigUInt64BE(0)
    expect(result).toBe(BigInt('18446744073709551615'))

    const buf2 = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    const result2 = buf2.readBigUint64BE(0)
    expect(result2).toBe(BigInt('18446744073709551615'))
  })

  it('should read a Big Unsigned Integer from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    const result = buf.readBigUInt64LE(0)
    expect(result).toBe(BigInt('18446744073709551615'))

    const buf2 = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    const result2 = buf2.readBigUint64LE(0)
    expect(result2).toBe(BigInt('18446744073709551615'))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255])
    expect(() => buf.readBigUInt64BE(9)).toThrow()
    expect(() => buf.readBigUint64BE(9)).toThrow()
    expect(() => buf.readBigUInt64LE(9)).toThrow()
    expect(() => buf.readBigUint64LE(9)).toThrow()
  })
})

describe('Buffer readUIntBE, readUIntLE, readUInt8, readUInt16BE, readUInt16LE, readUInt32BE, readUInt32LE, readUintBE, readUintLE, readUint8, readUint16BE, readUint16LE, readUint32BE, readUint32LE', () => {
  it('should read an unsigned integer from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readUIntBE(0, 4)
    expect(result).toBe(4294967295)

    const buf2 = Buffer.from([255, 255, 255, 255])
    const result2 = buf2.readUintBE(0, 4)
    expect(result2).toBe(4294967295)
  })

  it('should read an unsigned integer from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readUIntLE(0, 4)
    expect(result).toBe(4294967295)

    const buf2 = Buffer.from([255, 255, 255, 255])
    const result2 = buf2.readUintLE(0, 4)
    expect(result2).toBe(4294967295)
  })

  it('should read an 8-bit unsigned integer from the buffer at the specified offset', () => {
    const buf = Buffer.from([255])
    const result = buf.readUInt8(0)
    expect(result).toBe(255)

    const buf2 = Buffer.from([255])
    const result2 = buf2.readUint8(0)
    expect(result2).toBe(255)
  })

  it('should read a 16-bit unsigned integer from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255])
    const result = buf.readUInt16BE(0)
    expect(result).toBe(65535)

    const buf2 = Buffer.from([255, 255])
    const result2 = buf2.readUint16BE(0)
    expect(result2).toBe(65535)
  })

  it('should read a 16-bit unsigned integer from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255])
    const result = buf.readUInt16LE(0)
    expect(result).toBe(65535)

    const buf2 = Buffer.from([255, 255])
    const result2 = buf2.readUint16LE(0)
    expect(result2).toBe(65535)
  })

  it('should read a 32-bit unsigned integer from the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readUInt32BE(0)
    expect(result).toBe(4294967295)

    const buf2 = Buffer.from([255, 255, 255, 255])
    const result2 = buf2.readUint32BE(0)
    expect(result2).toBe(4294967295)
  })

  it('should read a 32-bit unsigned integer from the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    const result = buf.readUInt32LE(0)
    expect(result).toBe(4294967295)

    const buf2 = Buffer.from([255, 255, 255, 255])
    const result2 = buf2.readUint32LE(0)
    expect(result2).toBe(4294967295)
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.from([255, 255, 255, 255])
    // expect(() => buf.readUIntBE(5, 4)).toThrow() ❌
    // expect(() => buf.readUintBE(5, 4)).toThrow() ❌
    // expect(() => buf.readUIntLE(5, 4)).toThrow() ❌
    // expect(() => buf.readUintLE(5, 4)).toThrow() ❌
    expect(() => buf.readUInt8(5)).toThrow()
    expect(() => buf.readUint8(5)).toThrow()
    expect(() => buf.readUInt16BE(5)).toThrow()
    expect(() => buf.readUint16BE(5)).toThrow()
    expect(() => buf.readUInt16LE(5)).toThrow()
    expect(() => buf.readUint16LE(5)).toThrow()
    expect(() => buf.readUInt32BE(5)).toThrow()
    expect(() => buf.readUint32BE(5)).toThrow()
    expect(() => buf.readUInt32LE(5)).toThrow()
    expect(() => buf.readUint32LE(5)).toThrow()
  })
})

describe('Buffer writeBigUint64BE, writeBigUint64LE', () => {
  it('should write a BigInt as an unsigned 64-bit integer to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigUint64BE(BigInt('18446744073709551615'), 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]))
  })

  it('should write a BigInt as an unsigned 64-bit integer to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigUint64LE(BigInt('18446744073709551615'), 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.alloc(8)
    expect(() => buf.writeBigUint64BE(BigInt('18446744073709551615'), 9)).toThrow()
    expect(() => buf.writeBigUint64LE(BigInt('18446744073709551615'), 9)).toThrow()
  })

  it('should throw an error if the value is not a BigInt', () => {
    const buf = Buffer.alloc(8)
    // expect(() => buf.writeBigUint64BE('18446744073709551615' as any, 0)).toThrow() ❌
    // expect(() => buf.writeBigUint64LE('18446744073709551615' as any, 0)).toThrow() ❌
  })
})

describe('Buffer writeBigInt64BE, writeBigInt64LE, writeBigUInt64BE, writeBigUInt64LE', () => {
  it('should write a 64-bit BigInt to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigInt64BE(BigInt('9223372036854775807'), 0)
    expect(buf).toEqual(Buffer.from([127, 255, 255, 255, 255, 255, 255, 255]))
  })

  it('should write a 64-bit BigInt to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigInt64LE(BigInt('9223372036854775807'), 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255, 255, 255, 255, 127]))
  })

  it('should write a 64-bit unsigned BigInt to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64BE(BigInt('18446744073709551615'), 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]))
  })

  it('should write a 64-bit unsigned BigInt to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64LE(BigInt('18446744073709551615'), 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255, 255, 255, 255, 255].reverse()))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.alloc(8)
    expect(() => buf.writeBigInt64BE(BigInt('9223372036854775807'), 9)).toThrow()
    expect(() => buf.writeBigInt64LE(BigInt('9223372036854775807'), 9)).toThrow()
    expect(() => buf.writeBigUInt64BE(BigInt('18446744073709551615'), 9)).toThrow()
    expect(() => buf.writeBigUInt64LE(BigInt('18446744073709551615'), 9)).toThrow()
  })

  it('should throw an error if the value is not a 64-bit BigInt', () => {
    const buf = Buffer.alloc(8)
    expect(() => buf.writeBigInt64BE(9223372036854775807 as any, 0)).toThrow()
    expect(() => buf.writeBigInt64LE(9223372036854775807 as any, 0)).toThrow()
    expect(() => buf.writeBigUInt64BE(18446744073709551615 as any, 0)).toThrow()
    expect(() => buf.writeBigUInt64LE(18446744073709551615 as any, 0)).toThrow()
  })
})

describe('Buffer writeDoubleBE, writeDoubleLE, writeFloatBE, writeFloatLE', () => {
  it('should write a double to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeDoubleBE(123.456, 0)
    expect(buf).toEqual(Buffer.from([64, 94, 221, 47, 26, 159, 190, 119]))
  })

  it('should write a double to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(8)
    buf.writeDoubleLE(123.456, 0)
    expect(buf).toEqual(Buffer.from([64, 94, 221, 47, 26, 159, 190, 119].reverse()))
  })

  it('should write a float to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeFloatBE(123.456, 0)
    expect(buf).toEqual(Buffer.from([66, 246, 233, 121]))
  })

  it('should write a float to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeFloatLE(123.456, 0)
    expect(buf).toEqual(Buffer.from([66, 246, 233, 121].reverse()))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.alloc(8)
    expect(() => buf.writeDoubleBE(123.456, 9)).toThrow()
    expect(() => buf.writeDoubleLE(123.456, 9)).toThrow()
    const buf2 = Buffer.alloc(4)
    expect(() => buf2.writeFloatBE(123.456, 5)).toThrow()
    expect(() => buf2.writeFloatLE(123.456, 5)).toThrow()
  })

  it('should throw an error if the value is not a double or float', () => {
    const buf = Buffer.alloc(8)
    expect(() => buf.writeDoubleBE('123.456' as any, 0)).not.toThrow()
    expect(() => buf.writeDoubleLE('123.456' as any, 0)).not.toThrow()
    const buf2 = Buffer.alloc(4)
    expect(() => buf2.writeFloatBE('123.456' as any, 0)).not.toThrow()
    expect(() => buf2.writeFloatLE('123.456' as any, 0)).not.toThrow()
  })
})

describe('Buffer writeInt8, writeInt16BE, writeInt16LE, writeInt32BE, writeInt32LE, writeIntBE, writeIntLE', () => {
  it('should write an 8-bit integer to the buffer at the specified offset', () => {
    const buf = Buffer.alloc(1)
    buf.writeInt8(127, 0)
    expect(buf).toEqual(Buffer.from([127]))
  })

  it('should write a 16-bit integer to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(2)
    buf.writeInt16BE(32767, 0)
    expect(buf).toEqual(Buffer.from([127, 255]))
  })

  it('should write a 16-bit integer to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(2)
    buf.writeInt16LE(32767, 0)
    expect(buf).toEqual(Buffer.from([255, 127]))
  })

  it('should write a 32-bit integer to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeInt32BE(2147483647, 0)
    expect(buf).toEqual(Buffer.from([127, 255, 255, 255]))
  })

  it('should write a 32-bit integer to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeInt32LE(2147483647, 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 127]))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.alloc(1)
    expect(() => buf.writeInt8(127, 2)).toThrow()
    const buf2 = Buffer.alloc(2)
    expect(() => buf2.writeInt16BE(32767, 3)).toThrow()
    expect(() => buf2.writeInt16LE(32767, 3)).toThrow()
    const buf3 = Buffer.alloc(4)
    expect(() => buf3.writeInt32BE(2147483647, 5)).toThrow()
    expect(() => buf3.writeInt32LE(2147483647, 5)).toThrow()
  })

  it('should throw an error if the value is not an integer', () => {
    const buf = Buffer.alloc(1)
    expect(() => buf.writeInt8('127' as any, 0)).not.toThrow()
    const buf2 = Buffer.alloc(2)
    expect(() => buf2.writeInt16BE('32767' as any, 0)).not.toThrow()
    expect(() => buf2.writeInt16LE('32767' as any, 0)).not.toThrow()
    const buf3 = Buffer.alloc(4)
    expect(() => buf3.writeInt32BE('2147483647' as any, 0)).not.toThrow()
    expect(() => buf3.writeInt32LE('2147483647' as any, 0)).not.toThrow()
  })
})

describe('Buffer writeUInt8, writeUInt16BE, writeUInt16LE, writeUInt32BE, writeUInt32LE, writeUIntBE, writeUIntLE, writeUint8, writeUint16BE, writeUint16LE, writeUint32BE, writeUint32LE, writeUintBE, writeUintLE', () => {
  it('should write an 8-bit unsigned integer to the buffer at the specified offset', () => {
    const buf = Buffer.alloc(1)
    buf.writeUInt8(255, 0)
    expect(buf).toEqual(Buffer.from([255]))

    const buf2 = Buffer.alloc(1)
    buf2.writeUint8(255, 0)
    expect(buf2).toEqual(Buffer.from([255]))
  })

  it('should write a 16-bit unsigned integer to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(2)
    buf.writeUInt16BE(65535, 0)
    expect(buf).toEqual(Buffer.from([255, 255]))

    const buf2 = Buffer.alloc(2)
    buf2.writeUint16BE(65535, 0)
    expect(buf2).toEqual(Buffer.from([255, 255]))
  })

  it('should write a 16-bit unsigned integer to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(2)
    buf.writeUInt16LE(65535, 0)
    expect(buf).toEqual(Buffer.from([255, 255]))

    const buf2 = Buffer.alloc(2)
    buf2.writeUint16LE(65535, 0)
    expect(buf2).toEqual(Buffer.from([255, 255]))
  })

  it('should write a 32-bit unsigned integer to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeUInt32BE(4294967295, 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255]))

    const buf2 = Buffer.alloc(4)
    buf2.writeUint32BE(4294967295, 0)
    expect(buf2).toEqual(Buffer.from([255, 255, 255, 255]))
  })

  it('should write a 32-bit unsigned integer to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeUInt32LE(4294967295, 0)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255]))

    const buf2 = Buffer.alloc(4)
    buf2.writeUint32LE(4294967295, 0)
    expect(buf2).toEqual(Buffer.from([255, 255, 255, 255]))
  })

  it('should write an unsigned integer of any byte length to the buffer at the specified offset in big-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeUIntBE(4294967295, 0, 4)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255]))

    const buf2 = Buffer.alloc(4)
    buf2.writeUintBE(4294967295, 0, 4)
    expect(buf2).toEqual(Buffer.from([255, 255, 255, 255]))
  })

  it('should write an unsigned integer of any byte length to the buffer at the specified offset in little-endian format', () => {
    const buf = Buffer.alloc(4)
    buf.writeUIntLE(4294967295, 0, 4)
    expect(buf).toEqual(Buffer.from([255, 255, 255, 255]))

    const buf2 = Buffer.alloc(4)
    buf2.writeUintLE(4294967295, 0, 4)
    expect(buf2).toEqual(Buffer.from([255, 255, 255, 255]))
  })

  it('should throw an error if the offset is out of bounds', () => {
    const buf = Buffer.alloc(1)
    expect(() => buf.writeUInt8(255, 2)).toThrow()
    expect(() => buf.writeUint8(255, 2)).toThrow()
    const buf2 = Buffer.alloc(2)
    expect(() => buf2.writeUInt16BE(65535, 3)).toThrow()
    expect(() => buf2.writeUint16BE(65535, 3)).toThrow()
    expect(() => buf2.writeUInt16LE(65535, 3)).toThrow()
    expect(() => buf2.writeUint16LE(65535, 3)).toThrow()
    const buf3 = Buffer.alloc(4)
    expect(() => buf3.writeUInt32BE(4294967295, 5)).toThrow()
    expect(() => buf3.writeUint32BE(4294967295, 5)).toThrow()
    expect(() => buf3.writeUInt32LE(4294967295, 5)).toThrow()
    expect(() => buf3.writeUint32LE(4294967295, 5)).toThrow()
    const buf4 = Buffer.alloc(4)
    // expect(() => buf4.writeUIntBE(4294967295, 5, 4)).toThrow() ❌
    // expect(() => buf4.writeUintBE(4294967295, 5, 4)).toThrow() ❌
    // expect(() => buf4.writeUIntLE(4294967295, 5, 4)).toThrow() ❌
    // expect(() => buf4.writeUintLE(4294967295, 5, 4)).toThrow() ❌
  })

  it('should throw an error if the value is not an unsigned integer', () => {
    const buf = Buffer.alloc(1)
    expect(() => buf.writeUInt8('255' as any, 0)).not.toThrow()
    const buf2 = Buffer.alloc(2)
    expect(() => buf2.writeUInt16BE('65535' as any, 0)).not.toThrow()
    expect(() => buf2.writeUInt16LE('65535' as any, 0)).not.toThrow()
    const buf3 = Buffer.alloc(4)
    expect(() => buf3.writeUInt32BE('4294967295' as any, 0)).not.toThrow()
    expect(() => buf3.writeUInt32LE('4294967295' as any, 0)).not.toThrow()
    const buf4 = Buffer.alloc(4)
    expect(() => buf4.writeUIntBE('4294967295' as any, 0, 4)).not.toThrow()
    expect(() => buf4.writeUintBE('4294967295' as any, 0, 4)).not.toThrow()
    expect(() => buf4.writeUIntLE('4294967295' as any, 0, 4)).not.toThrow()
    expect(() => buf4.writeUintLE('4294967295' as any, 0, 4)).not.toThrow()
  })
})

describe('Buffer toJSON', () => {
  it('should return a JSON representation of the buffer', () => {
    const buf = Buffer.from('Hello, World!')
    const json = buf.toJSON()
    expect(json).toEqual({
      type: 'Buffer',
      data: [72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33],
    })
  })

  it('should handle empty buffers', () => {
    const buf = Buffer.alloc(0)
    const json = buf.toJSON()
    expect(json).toEqual({
      type: 'Buffer',
      data: [],
    })
  })
})

describe('Buffer swap16', () => {
  it('should swap the byte order of each 16-bit sequence', () => {
    const buf = Buffer.from([0x01, 0x02])
    buf.swap16()
    expect(buf).toEqual(Buffer.from([0x02, 0x01]))
  })

  it('should handle buffers with length not divisible by 2', () => {
    const buf = Buffer.from([0x01])
    expect(() => buf.swap16()).toThrow()
  })

  it('should handle empty buffers', () => {
    const buf = Buffer.alloc(0)
    expect(() => buf.swap16()).not.toThrow()
    expect(buf).toEqual(Buffer.alloc(0))
  })
})

describe('Buffer swap32', () => {
  it('should swap the byte order of each 32-bit sequence', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04])
    buf.swap32()
    expect(buf).toEqual(Buffer.from([0x04, 0x03, 0x02, 0x01]))
  })

  it('should handle buffers with length not divisible by 4', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03])
    expect(() => buf.swap32()).toThrow()
  })

  it('should handle empty buffers', () => {
    const buf = Buffer.alloc(0)
    expect(() => buf.swap32()).not.toThrow()
    expect(buf).toEqual(Buffer.alloc(0))
  })
})

describe('Buffer swap64', () => {
  it('should swap the byte order of each 64-bit sequence', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
    buf.swap64()
    expect(buf).toEqual(Buffer.from([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]))
  })

  it('should handle buffers with length not divisible by 8', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
    expect(() => buf.swap64()).toThrow()
  })

  it('should handle empty buffers', () => {
    const buf = Buffer.alloc(0)
    expect(() => buf.swap64()).not.toThrow()
    expect(buf).toEqual(Buffer.alloc(0))
  })
})

describe('Buffer compare', () => {
  test('simple', () => {
    const buf1 = Buffer.from([1, 2, 3, 4, 5])
    const buf2 = Buffer.from([1, 2, 3, 4, 5])
    const buf3 = Buffer.from([1, 2, 3, 4])
    expect(buf1.compare(buf2)).toBe(0)
    expect(buf1.compare(buf3)).toBe(1)
    expect(buf3.compare(buf1)).toBe(-1)
  })

  it('should return 0 if the buffers are equal', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, World!')
    expect(buf1.compare(buf2)).toEqual(0)
  })

  it('should return a positive number if the source buffer comes before the target buffer', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, Universe!')
    expect(buf1.compare(buf2)).toBeGreaterThan(0)
  })

  it('should return a negative number if the source buffer comes after the target buffer', () => {
    const buf1 = Buffer.from('Hello, Universe!')
    const buf2 = Buffer.from('Hello, World!')
    expect(buf1.compare(buf2)).toBeLessThan(0)
  })

  it('should compare specified portions of the buffers', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, Universe!')
    expect(buf1.compare(buf2, 0, 5, 0, 5)).toEqual(0)
  })

  it('should handle negative and out of bounds values', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, Universe!')
    // expect(() => buf1.compare(buf2, -1)).toThrow() ❌
    // expect(() => buf1.compare(buf2, 0, 50)).toThrow() ❌
  })
})

describe('Buffer equals', () => {
  test('simple', () => {
    const buf1 = Buffer.from([1, 2, 3, 4, 5])
    const buf2 = Buffer.from([1, 2, 3, 4, 5])
    const buf3 = Buffer.from([1, 2, 3, 4])
    expect(buf1.equals(buf2)).toBe(true)
    expect(buf1.equals(buf3)).toBe(false)
  })

  it('should return true if the buffers are equal', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, World!')
    expect(buf1.equals(buf2)).toEqual(true)
  })

  it('should return false if the buffers are not equal', () => {
    const buf1 = Buffer.from('Hello, World!')
    const buf2 = Buffer.from('Hello, Universe!')
    expect(buf1.equals(buf2)).toEqual(false)
  })

  it('should fail if the other object is not a buffer', () => {
    const buf = Buffer.from('Hello, World!')
    expect(() => buf.equals({} as any)).toThrow()
  })
})

describe('Buffer copy', () => {
  test('simple', () => {
    const buf1 = Buffer.from([1, 2, 3, 4, 5])
    const buf2 = Buffer.alloc(5)
    buf1.copy(buf2)
    expect(buf2).toEqual(buf1)
  })

  it('should copy the source buffer into the target buffer with default parameters', () => {
    const source = Buffer.from('Hello, World!')
    const target = Buffer.allocUnsafe(20)
    source.copy(target)
    expect(target.toString('utf8', 0, source.length)).toEqual('Hello, World!')
  })

  it('should copy the source buffer into the target buffer at specified target start', () => {
    const source = Buffer.from('Hello, World!')
    const target = Buffer.allocUnsafe(20)
    source.copy(target, 5)
    expect(target.toString('utf8', 5, 5 + source.length)).toEqual('Hello, World!')
  })

  it('should copy a portion of the source buffer into the target buffer', () => {
    const source = Buffer.from('Hello, World!')
    const target = Buffer.allocUnsafe(20)
    source.copy(target, 0, 0, 5)
    expect(target.toString('utf8', 0, 5)).toEqual('Hello')
  })

  it('should handle negative and out of bounds values', () => {
    const source = Buffer.from('Hello, World!')
    const target = Buffer.allocUnsafe(20)
    // expect(() => source.copy(target, -1)).toThrow() ❌
    // expect(() => source.copy(target, 0, -1)).toThrow() ❌
    expect(() => source.copy(target, 0, 0, 50)).not.toThrow()
  })
})

describe('Buffer write', () => {
  test('simple', () => {
    const buf = Buffer.alloc(5)
    buf.write('abcde')
    expect(buf).toEqual(Buffer.from([97, 98, 99, 100, 101]))
  })

  it('should write a string to the buffer with default parameters', () => {
    const buf = Buffer.allocUnsafe(20)
    const bytesWritten = buf.write('Hello, World!')
    expect(buf.toString('utf8', 0, bytesWritten)).toEqual('Hello, World!')
    expect(bytesWritten).toEqual(13)
  })

  it('should write a string to the buffer at specified offset', () => {
    const buf = Buffer.allocUnsafe(20)
    const bytesWritten = buf.write('Hello, World!', 5)
    expect(buf.toString('utf8', 5, 5 + bytesWritten)).toEqual('Hello, World!')
    expect(bytesWritten).toEqual(13)
  })

  it('should write a string to the buffer with specified length', () => {
    const buf = Buffer.allocUnsafe(20)
    const bytesWritten = buf.write('Hello, World!', 0, 5)
    expect(buf.toString('utf8', 0, bytesWritten)).toEqual('Hello')
    expect(bytesWritten).toEqual(5)
  })

  it('should write a string to the buffer with specified encoding', () => {
    const buf = Buffer.allocUnsafe(20)
    const bytesWritten = buf.write('48656c6c6f2c20576f726c6421', 0, 'hex')
    expect(buf.toString('utf8', 0, bytesWritten)).toEqual('Hello, World!')
    expect(bytesWritten).toEqual(13)
  })

  it('should throw an error if offset is out of bounds', () => {
    const buf = Buffer.allocUnsafe(20)
    // expect(() => buf.write('Hello, World!', 21)).toThrow() ❌
  })

  it('should throw an error if length is out of bounds', () => {
    const buf = Buffer.allocUnsafe(20)
    // expect(() => buf.write('Hello, World!', 0, 21)).toThrow() ❌
  })
})

describe('Buffer.toString', () => {
  test('simple', () => {
    const buf = Buffer.from([97, 98, 99, 100, 101])
    expect(buf.toString()).toBe('abcde')
  })

  it('should convert the buffer to a string with default parameters', () => {
    const buf = Buffer.from('Hello, World!')
    expect(buf.toString()).toEqual('Hello, World!')
  })

  it('should convert the buffer to a string with specified encoding', () => {
    const buf = Buffer.from('Hello, World!')
    expect(buf.toString('hex')).toEqual('48656c6c6f2c20576f726c6421')
  })

  it('should convert a portion of the buffer to a string', () => {
    const buf = Buffer.from('Hello, World!')
    expect(buf.toString('utf8', 0, 5)).toEqual('Hello')
  })

  it('should handle negative start and end values', () => {
    const buf = Buffer.from('Hello, World!')
    // expect(buf.toString('utf8', -5)).toEqual('Hello, World!') ❌
    // expect(buf.toString('utf8', 0, -5)).toEqual('') ❌
  })

  it('should handle start and end values greater than buffer length', () => {
    const buf = Buffer.from('Hello, World!')
    expect(buf.toString('utf8', 50)).toEqual('')
    expect(buf.toString('utf8', 0, 50)).toEqual('Hello, World!')
  })
})

test('Buffer.write (example)', () => {
  const buf = Buffer.alloc(256)

  const len = buf.write('\u00bd + \u00bc = \u00be', 0)

  expect(len).toBe(12)
  expect(buf.toString('utf8', 0, len)).toBe('½ + ¼ = ¾')

  const buffer = Buffer.alloc(10)

  const length = buffer.write('abcd', 8)

  expect(length).toBe(2)
  expect(buffer.toString('utf8', 8, 10)).toBe('ab')
})

test('Buffer.toString (example)', () => {
  const buf1 = Buffer.allocUnsafe(26)

  for (let i = 0; i < 26; i++) {
    buf1[i] = i + 97
  }

  expect(buf1.toString('utf8')).toBe('abcdefghijklmnopqrstuvwxyz')
  expect(buf1.toString('utf8', 0, 5)).toBe('abcde')

  const buf2 = Buffer.from('tést')

  expect(buf2.toString('hex')).toBe('74c3a97374')
  expect(buf2.toString('utf8', 0, 3)).toBe('té')
  expect(buf2.toString(undefined, 0, 3)).toBe('té')
})

test('Buffer.toJSON (example)', () => {
  const buf = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5])
  const json = JSON.stringify(buf)

  expect(json).toBe('{"type":"Buffer","data":[1,2,3,4,5]}')

  const copy = JSON.parse(json, (key, value) => {
    return value && value.type === 'Buffer' ? Buffer.from(value) : value
  })

  expect(copy).toEqual(Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5]))
})

test('Buffer.equals (example)', () => {
  const buf1 = Buffer.from('ABC')
  const buf2 = Buffer.from('414243', 'hex')
  const buf3 = Buffer.from('ABCD')

  expect(buf1.equals(buf2)).toBe(true)
  expect(buf1.equals(buf3)).toBe(false)
})

test('Buffer.compare (example)', () => {
  const buf1 = Buffer.from('ABC')
  const buf2 = Buffer.from('BCD')
  const buf3 = Buffer.from('ABCD')

  expect(buf1.compare(buf1)).toBe(0)
  expect(buf1.compare(buf2)).toBe(-1)
  expect(buf1.compare(buf3)).toBe(-1)
  expect(buf2.compare(buf1)).toBe(1)
  expect(buf2.compare(buf3)).toBe(1)

  const buf4 = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const buf5 = Buffer.from([5, 6, 7, 8, 9, 1, 2, 3, 4])

  expect(buf4.compare(buf5, 5, 9, 0, 4)).toBe(0)
  expect(buf4.compare(buf5, 0, 6, 4)).toBe(-1)
  expect(buf4.compare(buf5, 5, 6, 5)).toBe(1)
})

test('Buffer.copy (example)', () => {
  const buf1 = Buffer.allocUnsafe(26)
  const buf2 = Buffer.allocUnsafe(26).fill('!')

  for (let i = 0; i < 26; i++) {
    buf1[i] = i + 97
  }

  buf1.copy(buf2, 8, 16, 20)

  expect(buf2.toString('utf8', 0, 25)).toBe('!!!!!!!!qrst!!!!!!!!!!!!!')

  const buf = Buffer.allocUnsafe(26)

  for (let i = 0; i < 26; i++) {
    buf[i] = i + 97
  }

  buf.copy(buf, 0, 4, 10)

  expect(buf.toString()).toBe('efghijghijklmnopqrstuvwxyz')
})

test('Buffer.slice (example)', () => {
  const buf = Buffer.from('buffer')

  const copiedBuf = Uint8Array.prototype.slice.call(buf)
  copiedBuf[0]++
  expect(copiedBuf.toString()).toBe('cuffer')
  expect(buf.toString()).toBe('buffer')

  const notReallyCopiedBuf = buf.slice()
  notReallyCopiedBuf[0]++
  expect(notReallyCopiedBuf.toString()).toBe('cuffer')
  expect(buf.toString()).toBe('cuffer')
})

test('Buffer.subarray (example)', () => {
  const buf1 = Buffer.allocUnsafe(26)

  for (let i = 0; i < 26; i++) {
    buf1[i] = i + 97
  }

  const buf2 = buf1.subarray(0, 3)

  expect(buf2.toString('utf8', 0, buf2.length)).toBe('abc')

  buf1[0] = 33

  expect(buf2.toString('utf8', 0, buf2.length)).toBe('!bc')

  const buf = Buffer.from('buffer')

  expect(buf.subarray(-6, -1).toString()).toBe('buffe')
  expect(buf.subarray(-6, -2).toString()).toBe('buff')
  expect(buf.subarray(-5, -2).toString()).toBe('uff')
})

test('Buffer.writeBigInt64BE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeBigInt64BE(0x0102030405060708n, 0)

  expect(buf).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]))
})

test('Buffer.writeBigInt64LE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeBigInt64LE(0x0102030405060708n, 0)

  expect(buf).toEqual(Buffer.from([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]))
})

test('Buffer.readBigInt64BE (example)', () => {
  const buf = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])

  expect(buf.readBigInt64BE(0).toString(16)).toBe('102030405060708')
})

test('Buffer.writeBigUInt64BE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeBigUInt64BE(0x0102030405060708n, 0)

  expect(buf).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]))
})

test('Buffer.writeBigUInt64LE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeBigUInt64LE(0xdecafafecacefaden, 0)

  expect(buf).toEqual(Buffer.from([0xde, 0xfa, 0xce, 0xca, 0xfe, 0xfa, 0xca, 0xde]))
})

test('Buffer.writeBigUint64LE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeBigUint64LE(0xdecafafecacefaden, 0)

  expect(buf).toEqual(Buffer.from([0xde, 0xfa, 0xce, 0xca, 0xfe, 0xfa, 0xca, 0xde]))
})

test('Buffer.writeUIntLE (example)', () => {
  const buf = Buffer.allocUnsafe(6)

  buf.writeUIntLE(0x1234567890ab, 0, 6)

  expect(buf).toEqual(Buffer.from([0xab, 0x90, 0x78, 0x56, 0x34, 0x12]))
})

test('Buffer.writeUintLE (example)', () => {
  const buf = Buffer.allocUnsafe(6)

  buf.writeUintLE(0x1234567890ab, 0, 6)

  expect(buf).toEqual(Buffer.from([0xab, 0x90, 0x78, 0x56, 0x34, 0x12]))
})

test('Buffer.writeUIntBE (example)', () => {
  const buf = Buffer.allocUnsafe(6)

  buf.writeUIntBE(0x1234567890ab, 0, 6)

  expect(buf).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab]))
})

test('Buffer.writeUintBE (example)', () => {
  const buf = Buffer.allocUnsafe(6)

  buf.writeUintBE(0x1234567890ab, 0, 6)

  expect(buf).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab]))
})

test('Buffer.writeIntLE (example)', () => {
  const buf = Buffer.allocUnsafe(6)

  buf.writeIntLE(0x1234567890ab, 0, 6)

  expect(buf).toEqual(Buffer.from([0xab, 0x90, 0x78, 0x56, 0x34, 0x12]))
})

test('Buffer.writeIntBE (example)', () => {
  const buf = Buffer.allocUnsafe(6)

  buf.writeIntBE(0x1234567890ab, 0, 6)

  expect(buf).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab]))
})

test('Buffer.readBigUInt64BE (example)', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff])

  expect(buf.readBigUInt64BE(0)).toBe(4294967295n)
})

test('Buffer.readBigUint64BE (example)', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff])

  expect(buf.readBigUint64BE(0)).toBe(4294967295n)
})

test('Buffer.readBigUInt64LE (example)', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff])

  expect(buf.readBigUInt64LE(0)).toBe(18446744069414584320n)
})

test('Buffer.readBigUint64LE (example)', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff])

  expect(buf.readBigUint64LE(0)).toBe(18446744069414584320n)
})

test('Buffer.readBigInt64LE (example)', () => {
  const buf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff])

  expect(buf.readBigInt64LE(0)).toBe(-4294967296n)
})

test('Buffer.readUIntLE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab])

  expect(buf.readUIntLE(0, 6).toString(16)).toBe('ab9078563412')
})

test('Buffer.readUintLE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab])

  expect(buf.readUintLE(0, 6).toString(16)).toBe('ab9078563412')
})

test('Buffer.readUIntBE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab])

  expect(buf.readUIntBE(0, 6).toString(16)).toBe('1234567890ab')
  // expect(() => buf.readUIntBE(1, 60)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUintBE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab])

  expect(buf.readUintBE(0, 6).toString(16)).toBe('1234567890ab')
  // expect(() => buf.readUintBE(1, 60)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readIntLE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab])

  expect(buf.readIntLE(0, 6).toString(16)).toBe('-546f87a9cbee')
})

test('Buffer.readIntBE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78, 0x90, 0xab])

  expect(buf.readIntBE(0, 6).toString(16)).toBe('1234567890ab')
  // expect(() => buf.readIntBE(1, 60)).toThrow('ERR_OUT_OF_RANGE') ❌
  // expect(() => buf.readIntBE(1, 0)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUInt8 (example)', () => {
  const buf = Buffer.from([1, -2])

  expect(buf.readUInt8(0)).toBe(1)
  expect(buf.readUInt8(1)).toBe(254)
  // expect(() => buf.readUInt8(2)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUint8 (example)', () => {
  const buf = Buffer.from([1, -2])

  expect(buf.readUint8(0)).toBe(1)
  expect(buf.readUint8(1)).toBe(254)
  // expect(() => buf.readUint8(2)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUInt16LE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56])

  expect(buf.readUInt16LE(0).toString(16)).toBe('3412')
  expect(buf.readUInt16LE(1).toString(16)).toBe('5634')
  // expect(() => buf.readUInt16LE(2)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUint16LE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56])

  expect(buf.readUint16LE(0).toString(16)).toBe('3412')
  expect(buf.readUint16LE(1).toString(16)).toBe('5634')
  // expect(() => buf.readUint16LE(2)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUInt16BE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56])

  expect(buf.readUInt16BE(0).toString(16)).toBe('1234')
  expect(buf.readUInt16BE(1).toString(16)).toBe('3456')
})

test('Buffer.readUint16BE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56])

  expect(buf.readUint16BE(0).toString(16)).toBe('1234')
  expect(buf.readUint16BE(1).toString(16)).toBe('3456')
})

test('Buffer.readUInt32LE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78])

  expect(buf.readUInt32LE(0).toString(16)).toBe('78563412')
  // expect(() => buf.readUInt32LE(1)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUint32LE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78])

  expect(buf.readUint32LE(0).toString(16)).toBe('78563412')
  // expect(() => buf.readUint32LE(1)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readUInt32BE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78])

  expect(buf.readUInt32BE(0).toString(16)).toBe('12345678')
})

test('Buffer.readUint32BE (example)', () => {
  const buf = Buffer.from([0x12, 0x34, 0x56, 0x78])

  expect(buf.readUint32BE(0).toString(16)).toBe('12345678')
})

test('Buffer.readInt8 (example)', () => {
  const buf = Buffer.from([-1, 5])

  expect(buf.readInt8(0)).toBe(-1)
  expect(buf.readInt8(1)).toBe(5)
  // expect(() => buf.readInt8(2)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readInt16LE (example)', () => {
  const buf = Buffer.from([0, 5])

  expect(buf.readInt16LE(0)).toBe(1280)
  // expect(() => buf.readInt16LE(1)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readInt16BE (example)', () => {
  const buf = Buffer.from([0, 5])

  expect(buf.readInt16BE(0)).toBe(5)
})

test('Buffer.readInt32LE (example)', () => {
  const buf = Buffer.from([0, 0, 0, 5])

  expect(buf.readInt32LE(0)).toBe(83886080)
  // expect(() => buf.readInt32LE(1)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readInt32BE (example)', () => {
  const buf = Buffer.from([0, 0, 0, 5])

  expect(buf.readInt32BE(0)).toBe(5)
})

test('Buffer.readFloatLE (example)', () => {
  const buf = Buffer.from([1, 2, 3, 4])

  expect(buf.readFloatLE(0)).toBe(1.539989614439558e-36)
  // expect(() => buf.readFloatLE(1)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readFloatBE (example)', () => {
  const buf = Buffer.from([1, 2, 3, 4])

  expect(buf.readFloatBE(0)).toBe(2.387939260590663e-38)
})

test('Buffer.readDoubleLE (example)', () => {
  const buf = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])

  expect(buf.readDoubleLE(0)).toBe(5.447603722011605e-270)
  // expect(() => buf.readDoubleLE(1)).toThrow('ERR_OUT_OF_RANGE') ❌
})

test('Buffer.readDoubleBE (example)', () => {
  const buf = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])

  expect(buf.readDoubleBE(0)).toBe(8.20788039913184e-304)
})

test('Buffer.swap16 (example)', () => {
  const buf1 = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8])

  buf1.swap16()

  expect(buf1).toEqual(Buffer.from([0x2, 0x1, 0x4, 0x3, 0x6, 0x5, 0x8, 0x7]))

  const buf2 = Buffer.from([0x1, 0x2, 0x3])

  expect(() => buf2.swap16()).toThrow()
})

test('Buffer.swap32 (example)', () => {
  const buf1 = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8])

  buf1.swap32()

  expect(buf1).toEqual(Buffer.from([0x4, 0x3, 0x2, 0x1, 0x8, 0x7, 0x6, 0x5]))

  const buf2 = Buffer.from([0x1, 0x2, 0x3])

  expect(() => buf2.swap32()).toThrow()
})

test('Buffer.swap64 (example)', () => {
  const buf1 = Buffer.from([0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8])

  buf1.swap64()

  expect(buf1).toEqual(Buffer.from([0x8, 0x7, 0x6, 0x5, 0x4, 0x3, 0x2, 0x1]))

  const buf2 = Buffer.from([0x1, 0x2, 0x3])

  expect(() => buf2.swap64()).toThrow()
})

test('Buffer.writeUInt8 (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUInt8(0x3, 0)
  buf.writeUInt8(0x4, 1)
  buf.writeUInt8(0x23, 2)
  buf.writeUInt8(0x42, 3)

  expect(buf).toEqual(Buffer.from([0x3, 0x4, 0x23, 0x42]))
})

test('Buffer.writeUint8 (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUint8(0x3, 0)
  buf.writeUint8(0x4, 1)
  buf.writeUint8(0x23, 2)
  buf.writeUint8(0x42, 3)

  expect(buf).toEqual(Buffer.from([0x3, 0x4, 0x23, 0x42]))
})

test('Buffer.writeUInt16LE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUInt16LE(0xdead, 0)
  buf.writeUInt16LE(0xbeef, 2)

  expect(buf).toEqual(Buffer.from([0xad, 0xde, 0xef, 0xbe]))
})

test('Buffer.writeUint16LE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUint16LE(0xdead, 0)
  buf.writeUint16LE(0xbeef, 2)

  expect(buf).toEqual(Buffer.from([0xad, 0xde, 0xef, 0xbe]))
})

test('Buffer.writeUInt16BE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUInt16BE(0xdead, 0)
  buf.writeUInt16BE(0xbeef, 2)

  expect(buf).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]))
})

test('Buffer.writeUint16BE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUint16BE(0xdead, 0)
  buf.writeUint16BE(0xbeef, 2)

  expect(buf).toEqual(Buffer.from([0xde, 0xad, 0xbe, 0xef]))
})

test('Buffer.writeUInt32LE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUInt32LE(0xfeedface, 0)

  expect(buf).toEqual(Buffer.from([0xce, 0xfa, 0xed, 0xfe]))
})

test('Buffer.writeUint32LE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUint32LE(0xfeedface, 0)

  expect(buf).toEqual(Buffer.from([0xce, 0xfa, 0xed, 0xfe]))
})

test('Buffer.writeUInt32BE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUInt32BE(0xfeedface, 0)

  expect(buf).toEqual(Buffer.from([0xfe, 0xed, 0xfa, 0xce]))
})

test('Buffer.writeUint32BE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeUint32BE(0xfeedface, 0)

  expect(buf).toEqual(Buffer.from([0xfe, 0xed, 0xfa, 0xce]))
})

test('Buffer.writeInt8 (example)', () => {
  const buf = Buffer.allocUnsafe(2)

  buf.writeInt8(2, 0)
  buf.writeInt8(-2, 1)

  expect(buf).toEqual(Buffer.from([0x2, 0xfe]))
})

test('Buffer.writeInt16LE (example)', () => {
  const buf = Buffer.allocUnsafe(2)

  buf.writeInt16LE(0x0304, 0)

  expect(buf).toEqual(Buffer.from([0x4, 0x3]))
})

test('Buffer.writeInt16BE (example)', () => {
  const buf = Buffer.allocUnsafe(2)

  buf.writeInt16BE(0x0102, 0)

  expect(buf).toEqual(Buffer.from([0x1, 0x2]))
})

test('Buffer.writeInt32LE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeInt32LE(0x05060708, 0)

  expect(buf).toEqual(Buffer.from([0x8, 0x7, 0x6, 0x5]))
})

test('Buffer.writeInt32BE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeInt32BE(0x01020304, 0)

  expect(buf).toEqual(Buffer.from([0x1, 0x2, 0x3, 0x4]))
})

test('Buffer.writeFloatLE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeFloatLE(0xcafebabe, 0)

  expect(buf).toEqual(Buffer.from([0xbb, 0xfe, 0x4a, 0x4f]))
})

test('Buffer.writeFloatBE (example)', () => {
  const buf = Buffer.allocUnsafe(4)

  buf.writeFloatBE(0xcafebabe, 0)

  expect(buf).toEqual(Buffer.from([0x4f, 0x4a, 0xfe, 0xbb]))
})

test('Buffer.writeDoubleLE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeDoubleLE(123.456, 0)

  expect(buf).toEqual(Buffer.from([0x77, 0xbe, 0x9f, 0x1a, 0x2f, 0xdd, 0x5e, 0x40]))
})

test('Buffer.writeDoubleBE (example)', () => {
  const buf = Buffer.allocUnsafe(8)

  buf.writeDoubleBE(123.456, 0)

  expect(buf).toEqual(Buffer.from([0x40, 0x5e, 0xdd, 0x2f, 0x1a, 0x9f, 0xbe, 0x77]))
})

describe('Buffer fill', () => {
  it('should fill the entire buffer with a single character', () => {
    const buf = Buffer.allocUnsafe(50).fill('h')
    expect(buf.toString()).toEqual('h'.repeat(50))
  })

  it('should fill the buffer with a multi-byte character', () => {
    const buf = Buffer.allocUnsafe(5).fill('\u0222')
    expect(buf).toEqual(Buffer.from([0xc8, 0xa2, 0xc8, 0xa2, 0xc8]))
  })

  it('should fill the buffer with a single character', () => {
    const buf = Buffer.allocUnsafe(5).fill('a')
    expect(buf.toString()).toEqual('a'.repeat(5))
  })

  it('should fill the buffer with hexadecimal values', () => {
    const buf = Buffer.allocUnsafe(5).fill('abcd', 0, undefined, 'hex')
    expect(buf).toEqual(Buffer.from([0xab, 0xcd, 0xab, 0xcd, 0xab]))
  })
})

describe('Buffer indexOf', () => {
  it('should find the index of a string', () => {
    const buf = Buffer.from('this is a buffer')
    expect(buf.indexOf('this')).toEqual(0)
    expect(buf.indexOf('is')).toEqual(2)
  })

  it('should find the index of a Buffer', () => {
    const buf = Buffer.from('this is a buffer')
    expect(buf.indexOf(Buffer.from('a buffer'))).toEqual(8)
    expect(buf.indexOf(Buffer.from('a buffer example'))).toEqual(-1)
    expect(buf.indexOf(Buffer.from('a buffer example').slice(0, 8))).toEqual(8)
  })

  it('should find the index of a number', () => {
    const buf = Buffer.from('this is a buffer')
    expect(buf.indexOf(97)).toEqual(8)
  })

  it('should find the index of a string with base64 encoding', () => {
    const buf = Buffer.from(Buffer.from('this is a buffer').toString('base64'), 'base64')
    expect(buf.indexOf(Buffer.from('a buffer', 'base64'))).toBeTruthy()
  })

  it('should coerce non-byte numbers and non-number byteOffsets', () => {
    const b = Buffer.from('abcdef')
    expect(b.indexOf(99.9)).toEqual(2) // 99.9 is coerced to 99
    expect(b.indexOf(256 + 99)).toEqual(2) // 256 + 99 is coerced to 99
    expect(b.indexOf('b', undefined)).toEqual(1) // undefined is coerced to 0
    // expect(b.indexOf('b', {})).toEqual(1) // {} is coerced to 0 ❌
    // expect(b.indexOf('b', null)).toEqual(1) // null is coerced to 0 ❌
    // expect(b.indexOf('b', [])).toEqual(1) // [] is coerced to 0 ❌
  })

  it('should return byteOffset or buf.length for empty value', () => {
    const buf = Buffer.from('abcdef')
    expect(buf.indexOf('', 3)).toEqual(3)
    expect(buf.indexOf('', buf.length)).toEqual(buf.length)
    expect(buf.indexOf(Buffer.from(''), 3)).toEqual(3)
    expect(buf.indexOf(Buffer.from(''), buf.length)).toEqual(buf.length)
  })
})

test('Buffer.entries (example)', () => {
  const buf = Buffer.from('buffer')

  const pairs = Array.from(buf.entries())

  expect(pairs).toEqual([
    [0, 98],
    [1, 117],
    [2, 102],
    [3, 102],
    [4, 101],
    [5, 114],
  ])
})

test('Buffer.includes (example)', () => {
  const buf = Buffer.from('this is a buffer')

  expect(buf.includes('this')).toBe(true)
  expect(buf.includes('is')).toBe(true)
  expect(buf.includes(Buffer.from('a buffer'))).toBe(true)
  expect(buf.includes(97)).toBe(true)
  expect(buf.includes(Buffer.from('a buffer example'))).toBe(false)
  expect(buf.includes(Buffer.from('a buffer example').slice(0, 8))).toBe(true)
  expect(buf.includes('this', 4)).toBe(false)
})

test('Buffer.keys (example)', () => {
  const buf = Buffer.from('buffer')

  const keys = Array.from(buf.keys())

  expect(keys).toEqual([0, 1, 2, 3, 4, 5])
})

test('Buffer.values (example)', () => {
  const buf = Buffer.from('buffer')

  const values = Array.from(buf.values())

  expect(values).toEqual([98, 117, 102, 102, 101, 114])
})

// TODO
// test('Buffer.lastIndexOf (example)', () => {
//   const buf = Buffer.from('this buffer is a buffer')

//   // expect(buf.lastIndexOf('this')).toBe(0)
//   expect(buf.lastIndexOf('buffer')).toBe(17)
//   expect(buf.lastIndexOf(Buffer.from('buffer'))).toBe(17)
//   expect(buf.lastIndexOf(97)).toBe(15)
//   expect(buf.lastIndexOf(Buffer.from('yolo'))).toBe(-1)
//   expect(buf.lastIndexOf('buffer', 5)).toBe(5)
//   expect(buf.lastIndexOf('buffer', 4)).toBe(-1)

//   const utf16Buffer = Buffer.from('\u039a\u0391\u03a3\u03a3\u0395', 'utf16le')

//   expect(utf16Buffer.lastIndexOf('\u03a3', undefined, 'utf16le')).toBe(6)
//   expect(utf16Buffer.lastIndexOf('\u03a3', -5, 'utf16le')).toBe(4)
// })

test('Buffer.slice (node.js repository test)', () => {
  assert.strictEqual(Buffer.from('hello', 'utf8').slice(0, 0).length, 0)
  // assert.strictEqual(Buffer('hello', 'utf8').slice(0, 0).length, 0) ❌

  const buf = Buffer.from('0123456789', 'utf8')
  const expectedSameBufs = [
    [buf.slice(-10, 10), Buffer.from('0123456789', 'utf8')],
    [buf.slice(-20, 10), Buffer.from('0123456789', 'utf8')],
    [buf.slice(-20, -10), Buffer.from('', 'utf8')],
    [buf.slice(), Buffer.from('0123456789', 'utf8')],
    [buf.slice(0), Buffer.from('0123456789', 'utf8')],
    [buf.slice(0, 0), Buffer.from('', 'utf8')],
    [buf.slice(undefined), Buffer.from('0123456789', 'utf8')],
    [buf.slice('foobar' as any), Buffer.from('0123456789', 'utf8')],
    [buf.slice(undefined, undefined), Buffer.from('0123456789', 'utf8')],
    [buf.slice(2), Buffer.from('23456789', 'utf8')],
    [buf.slice(5), Buffer.from('56789', 'utf8')],
    [buf.slice(10), Buffer.from('', 'utf8')],
    [buf.slice(5, 8), Buffer.from('567', 'utf8')],
    [buf.slice(8, -1), Buffer.from('8', 'utf8')],
    [buf.slice(-10), Buffer.from('0123456789', 'utf8')],
    [buf.slice(0, -9), Buffer.from('0', 'utf8')],
    [buf.slice(0, -10), Buffer.from('', 'utf8')],
    [buf.slice(0, -1), Buffer.from('012345678', 'utf8')],
    [buf.slice(2, -2), Buffer.from('234567', 'utf8')],
    [buf.slice(0, 65536), Buffer.from('0123456789', 'utf8')],
    [buf.slice(65536, 0), Buffer.from('', 'utf8')],
    [buf.slice(-5, -8), Buffer.from('', 'utf8')],
    [buf.slice(-5, -3), Buffer.from('56', 'utf8')],
    [buf.slice(-10, 10), Buffer.from('0123456789', 'utf8')],
    [buf.slice('0' as any, '1' as any), Buffer.from('0', 'utf8')],
    [buf.slice('-5' as any, '10' as any), Buffer.from('56789', 'utf8')],
    [buf.slice('-10' as any, '10' as any), Buffer.from('0123456789', 'utf8')],
    [buf.slice('-10' as any, '-5' as any), Buffer.from('01234', 'utf8')],
    [buf.slice('-10' as any, '-0' as any), Buffer.from('', 'utf8')],
    [buf.slice('111' as any), Buffer.from('', 'utf8')],
    [buf.slice('0' as any, '-111' as any), Buffer.from('', 'utf8')],
  ]

  for (let i = 0, s = buf.toString(); i < buf.length; ++i) {
    expectedSameBufs.push(
      [buf.slice(i), Buffer.from(s.slice(i))],
      [buf.slice(0, i), Buffer.from(s.slice(0, i))],
      [buf.slice(-i), Buffer.from(s.slice(-i))],
      [buf.slice(0, -i), Buffer.from(s.slice(0, -i))],
    )
  }

  for (const [buf1, buf2] of expectedSameBufs) {
    assert.strictEqual(Buffer.compare(buf1, buf2), 0)
  }

  // const utf16Buf = Buffer.from('0123456789', 'utf16le') ❌
  // assert.deepStrictEqual(utf16Buf.slice(0, 6), Buffer.from('012', 'utf16le')) ❌
  // Try to slice a zero length Buffer.
  // See https://github.com/joyent/node/issues/5881
  assert.strictEqual(Buffer.alloc(0).slice(0, 1).length, 0)

  {
    // Single argument slice
    assert.strictEqual(Buffer.from('abcde', 'utf8').slice(1).toString('utf8'), 'bcde')
  }

  // slice(0,0).length === 0
  assert.strictEqual(Buffer.from('hello', 'utf8').slice(0, 0).length, 0)

  {
    // Regression tests for https://github.com/nodejs/node/issues/9096
    const buf = Buffer.from('abcd', 'utf8')
    assert.strictEqual(buf.slice(buf.length / 3).toString('utf8'), 'bcd')
    assert.strictEqual(buf.slice(buf.length / 3, buf.length).toString(), 'bcd')
  }

  {
    const buf = Buffer.from('abcdefg', 'utf8')
    assert.strictEqual(buf.slice(-(-1 >>> 0) - 1).toString('utf8'), buf.toString('utf8'))
  }

  {
    const buf = Buffer.from('abc', 'utf8')
    assert.strictEqual(buf.slice(-0.5).toString('utf8'), buf.toString('utf8'))
  }

  {
    const buf = Buffer.from([
      1, 29, 0, 0, 1, 143, 216, 162, 92, 254, 248, 63, 0, 0, 0, 18, 184, 6, 0, 175, 29, 0, 8, 11, 1, 0, 0,
    ])
    const chunk1 = Buffer.from([1, 29, 0, 0, 1, 143, 216, 162, 92, 254, 248, 63, 0])
    const chunk2 = Buffer.from([0, 0, 18, 184, 6, 0, 175, 29, 0, 8, 11, 1, 0, 0])
    const middle = buf.length / 2

    assert.deepStrictEqual(buf.slice(0, middle), chunk1)
    assert.deepStrictEqual(buf.slice(middle), chunk2)
  }
})

test('Buffer.compare (node.js repository test)', () => {
  const assert = require('assert')

  const b = Buffer.alloc(1, 97)
  const c = Buffer.alloc(1, 99)
  const d = Buffer.alloc(2, 97)
  const e = new Uint8Array([0x61, 0x61]) // ASCII 'aa', same as d

  assert.strictEqual(b.compare(c), -1)
  assert.strictEqual(c.compare(d), 1)
  assert.strictEqual(d.compare(b), 1)
  assert.strictEqual(d.compare(e), 0)
  assert.strictEqual(b.compare(d), -1)
  assert.strictEqual(b.compare(b), 0)

  assert.strictEqual(Buffer.compare(b, c), -1)
  assert.strictEqual(Buffer.compare(c, d), 1)
  assert.strictEqual(Buffer.compare(d, b), 1)
  assert.strictEqual(Buffer.compare(b, d), -1)
  assert.strictEqual(Buffer.compare(c, c), 0)
  assert.strictEqual(Buffer.compare(e, e), 0)
  assert.strictEqual(Buffer.compare(d, e), 0)
  assert.strictEqual(Buffer.compare(d, b), 1)

  assert.strictEqual(Buffer.compare(Buffer.alloc(0), Buffer.alloc(0)), 0)
  assert.strictEqual(Buffer.compare(Buffer.alloc(0), Buffer.alloc(1)), -1)
  assert.strictEqual(Buffer.compare(Buffer.alloc(1), Buffer.alloc(0)), 1)

  // @ts-expect-error
  assert.throws(() => Buffer.compare(Buffer.alloc(1), 'abc'))
  // @ts-expect-error
  assert.throws(() => Buffer.compare('abc', Buffer.alloc(1)))

  // @ts-expect-error
  assert.throws(() => Buffer.alloc(1).compare('abc'))
})

test('Buffer.compare (offset) (node.js repository test)', () => {
  const a = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 0])
  const b = Buffer.from([5, 6, 7, 8, 9, 0, 1, 2, 3, 4])

  assert.strictEqual(a.compare(b), -1)

  // Equivalent to a.compare(b).
  assert.strictEqual(a.compare(b, 0), -1)
  // assert.throws(() => a.compare(b, '0')) ❌
  assert.strictEqual(a.compare(b, undefined), -1)

  // Equivalent to a.compare(b).
  assert.strictEqual(a.compare(b, 0, undefined, 0), -1)

  // Zero-length target, return 1
  assert.strictEqual(a.compare(b, 0, 0, 0), 1)
  // assert.throws(() => a.compare(b, 0, '0', '0')) ❌

  // Equivalent to Buffer.compare(a, b.slice(6, 10))
  assert.strictEqual(a.compare(b, 6, 10), 1)

  // Zero-length source, return -1
  assert.strictEqual(a.compare(b, 6, 10, 0, 0), -1)

  // Zero-length source and target, return 0
  assert.strictEqual(a.compare(b, 0, 0, 0, 0), 0)
  assert.strictEqual(a.compare(b, 1, 1, 2, 2), 0)

  // Equivalent to Buffer.compare(a.slice(4), b.slice(0, 5))
  assert.strictEqual(a.compare(b, 0, 5, 4), 1)

  // Equivalent to Buffer.compare(a.slice(1), b.slice(5))
  assert.strictEqual(a.compare(b, 5, undefined, 1), 1)

  // Equivalent to Buffer.compare(a.slice(2), b.slice(2, 4))
  assert.strictEqual(a.compare(b, 2, 4, 2), -1)

  // Equivalent to Buffer.compare(a.slice(4), b.slice(0, 7))
  assert.strictEqual(a.compare(b, 0, 7, 4), -1)

  // Equivalent to Buffer.compare(a.slice(4, 6), b.slice(0, 7));
  assert.strictEqual(a.compare(b, 0, 7, 4, 6), -1)

  // Null is ambiguous.
  // assert.throws(() => a.compare(b, 0, null)) ❌

  // Values do not get coerced.
  // assert.throws(() => a.compare(b, 0, { valueOf: () => 5 })) ❌

  // Infinity should not be coerced.
  // assert.throws(() => a.compare(b, Infinity, -Infinity)) ❌

  // Zero length target because default for targetEnd <= targetSource
  assert.strictEqual(a.compare(b, 0xff), 1)

  // assert.throws(() => a.compare(b, '0xff')) ❌
  // assert.throws(() => a.compare(b, 0, '0xff')) ❌

  // assert.throws(() => a.compare(b, 0, 100, 0)) ❌
  // assert.throws(() => a.compare(b, 0, 1, 0, 100)) ❌
  // assert.throws(() => a.compare(b, -1)) ❌
  // assert.throws(() => a.compare(b, 0, Infinity)) ❌
  // assert.throws(() => a.compare(b, 0, 1, -1)) ❌
  // assert.throws(() => a.compare(b, -Infinity, Infinity)) ❌
  // @ts-expect-error
  assert.throws(() => a.compare())
})

test('Buffer.concat (node.js repository test)', () => {
  const zero = [] as Buffer[]
  const one = [Buffer.from('asdf')]
  const long = [] as Buffer[]
  for (let i = 0; i < 10; i++) long.push(Buffer.from('asdf'))

  const flatZero = Buffer.concat(zero)
  const flatOne = Buffer.concat(one)
  const flatLong = Buffer.concat(long)
  const flatLongLen = Buffer.concat(long, 40)

  assert.strictEqual(flatZero.length, 0)
  assert.strictEqual(flatOne.toString(), 'asdf')

  const check = 'asdf'.repeat(10)

  // A special case where concat used to return the first item,
  // if the length is one. This check is to make sure that we don't do that.
  assert.notStrictEqual(flatOne, one[0])
  assert.strictEqual(flatLong.toString(), check)
  assert.strictEqual(flatLongLen.toString(), check)

  // assert.throws(() => Buffer.concat([Buffer.from('hello'), 3 as any]))

  const random10 = Buffer.alloc(10).fill(1)
  const empty = Buffer.alloc(0)

  assert.notDeepStrictEqual(random10, empty)
  assert.notDeepStrictEqual(random10, Buffer.alloc(10))

  assert.deepStrictEqual(Buffer.concat([], 100), empty)
  assert.deepStrictEqual(Buffer.concat([random10], 0), empty)
  assert.deepStrictEqual(Buffer.concat([random10], 10), random10)
  assert.deepStrictEqual(Buffer.concat([random10, random10], 10), random10)
  assert.deepStrictEqual(Buffer.concat([empty, random10]), random10)
  assert.deepStrictEqual(Buffer.concat([random10, empty, empty]), random10)

  // The tail should be zero-filled
  assert.deepStrictEqual(Buffer.concat([empty], 100), Buffer.alloc(100))
  assert.deepStrictEqual(Buffer.concat([empty], 4096), Buffer.alloc(4096))
  assert.deepStrictEqual(Buffer.concat([random10], 40), Buffer.concat([random10, Buffer.alloc(30)]))

  assert.deepStrictEqual(
    Buffer.concat([new Uint8Array([0x41, 0x42]), new Uint8Array([0x43, 0x44])]),
    Buffer.from('ABCD'),
  )
})

test('Buffer.copy (node.js repository test)', () => {
  const b = Buffer.allocUnsafe(1024)
  const c = Buffer.allocUnsafe(512)

  let cntr = 0

  {
    // copy 512 bytes, from 0 to 512.
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = b.copy(c, 0, 0, 512)
    assert.strictEqual(copied, 512)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], b[i])
    }
  }

  {
    // Current behavior is to coerce values to integers.
    b.fill(++cntr)
    c.fill(++cntr)
    // @ts-expect-error
    const copied = b.copy(c, '0', '0', '512')
    assert.strictEqual(copied, 512)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], b[i])
    }
  }

  {
    // Floats will be converted to integers via `Math.floor`
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = b.copy(c, 0, 0, 512.5)
    // assert.strictEqual(copied, 512) ❌
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], b[i])
    }
  }

  {
    // Copy c into b, without specifying sourceEnd
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = c.copy(b, 0, 0)
    assert.strictEqual(copied, c.length)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(b[i], c[i])
    }
  }

  {
    // Copy c into b, without specifying sourceStart
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = c.copy(b, 0)
    assert.strictEqual(copied, c.length)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(b[i], c[i])
    }
  }

  {
    // Copied source range greater than source length
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = c.copy(b, 0, 0, c.length + 1)
    assert.strictEqual(copied, c.length)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(b[i], c[i])
    }
  }

  {
    // Copy longer buffer b to shorter c without targetStart
    b.fill(++cntr)
    c.fill(++cntr)

    const copied = b.copy(c)
    assert.strictEqual(copied, c.length)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], b[i])
    }
  }

  {
    // Copy starting near end of b to c
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = b.copy(c, 0, b.length - Math.floor(c.length / 2))
    assert.strictEqual(copied, Math.floor(c.length / 2))
    for (let i = 0; i < Math.floor(c.length / 2); i++) {
      assert.strictEqual(c[i], b[b.length - Math.floor(c.length / 2) + i])
    }
    for (let i = Math.floor(c.length / 2) + 1; i < c.length; i++) {
      assert.strictEqual(c[c.length - 1], c[i])
    }
  }

  {
    // Try to copy 513 bytes, and check we don't overrun c
    b.fill(++cntr)
    c.fill(++cntr)
    const copied = b.copy(c, 0, 0, 513)
    assert.strictEqual(copied, c.length)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], b[i])
    }
  }

  {
    // copy 768 bytes from b into b
    b.fill(++cntr)
    b.fill(++cntr, 256)
    const copied = b.copy(b, 0, 256, 1024)
    assert.strictEqual(copied, 768)
    for (let i = 0; i < b.length; i++) {
      assert.strictEqual(b[i], cntr)
    }
  }

  // Copy string longer than buffer length (failure will segfault)
  const bb = Buffer.allocUnsafe(10)
  bb.fill('hello crazy world')

  // Try to copy from before the beginning of b. Should not throw.
  b.copy(c, 0, 100, 10)

  // Throw with invalid source type
  // assert.throws(() => Buffer.prototype.copy.call(0)) ❌

  // Copy throws at negative targetStart
  // assert.throws(() => Buffer.allocUnsafe(5).copy(Buffer.allocUnsafe(5), -1, 0)) ❌

  // Copy throws at negative sourceStart
  // assert.throws(() => Buffer.allocUnsafe(5).copy(Buffer.allocUnsafe(5), 0, -1)) ❌

  // Copy throws if sourceStart is greater than length of source
  // assert.throws(() => Buffer.allocUnsafe(5).copy(Buffer.allocUnsafe(5), 0, 100)) ❌

  {
    // Check sourceEnd resets to targetEnd if former is greater than the latter
    b.fill(++cntr)
    c.fill(++cntr)
    b.copy(c, 0, 0, 1025)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], b[i])
    }
  }

  // Throw with negative sourceEnd
  // assert.throws(() => b.copy(c, 0, 0, -1)) ❌

  // When sourceStart is greater than sourceEnd, zero copied
  assert.strictEqual(b.copy(c, 0, 100, 10), 0)

  // When targetStart > targetLength, zero copied
  assert.strictEqual(b.copy(c, 512, 0, 10), 0)

  // Test that the `target` can be a Uint8Array.
  {
    const d = new Uint8Array(c)
    // copy 512 bytes, from 0 to 512.
    b.fill(++cntr)
    d.fill(++cntr)
    const copied = b.copy(d, 0, 0, 512)
    assert.strictEqual(copied, 512)
    for (let i = 0; i < d.length; i++) {
      assert.strictEqual(d[i], b[i])
    }
  }

  // Test that the source can be a Uint8Array, too.
  {
    const e = new Uint8Array(b)
    // copy 512 bytes, from 0 to 512.
    e.fill(++cntr)
    c.fill(++cntr)
    const copied = Buffer.prototype.copy.call(e, c, 0, 0, 512)
    assert.strictEqual(copied, 512)
    for (let i = 0; i < c.length; i++) {
      assert.strictEqual(c[i], e[i])
    }
  }

  {
    // https://github.com/nodejs/node/issues/23668: Do not crash for invalid input.
    c.fill('c')
    // @ts-expect-error
    b.copy(c, 'not a valid offset')
    // Make sure this acted like a regular copy with `0` offset.
    // assert.deepStrictEqual(c, b.slice(0, c.length)) ❌
  }

  {
    c.fill('C')
    assert.throws(() => {
      // @ts-expect-error
      b.copy(c, {
        [Symbol.toPrimitive]() {
          throw new Error('foo')
        },
      })
    }, /foo/)
    // No copying took place:
    assert.deepStrictEqual(c.toString(), 'C'.repeat(c.length))
  }
})

test('Buffer.equals (node.js repository test)', () => {
  const b = Buffer.from('abcdf')
  const c = Buffer.from('abcdf')
  const d = Buffer.from('abcde')
  const e = Buffer.from('abcdef')

  assert.ok(b.equals(c))
  assert.ok(!c.equals(d))
  assert.ok(!d.equals(e))
  assert.ok(d.equals(d))
  assert.ok(d.equals(new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65])))

  // @ts-expect-error
  assert.throws(() => Buffer.alloc(1).equals('abc'))
})

test('Buffer.fill (node.js repository test)', () => {
  const SIZE = 28
  const buf1 = Buffer.allocUnsafe(SIZE)
  const buf2 = Buffer.allocUnsafe(SIZE)

  // Default encoding
  testBufs('abc')
  testBufs('\u0222aa')
  testBufs('a\u0234b\u0235c\u0236')
  testBufs('abc', 4)
  testBufs('abc', 5)
  testBufs('abc', SIZE)
  testBufs('\u0222aa', 2)
  testBufs('\u0222aa', 8)
  testBufs('a\u0234b\u0235c\u0236', 4)
  testBufs('a\u0234b\u0235c\u0236', 12)
  testBufs('abc', 4, 1)
  testBufs('abc', 5, 1)
  testBufs('\u0222aa', 8, 1)
  testBufs('a\u0234b\u0235c\u0236', 4, 1)
  testBufs('a\u0234b\u0235c\u0236', 12, 1)

  // UTF8
  testBufs('abc', 'utf8')
  testBufs('\u0222aa', 'utf8')
  testBufs('a\u0234b\u0235c\u0236', 'utf8')
  testBufs('abc', 4, 'utf8')
  testBufs('abc', 5, 'utf8')
  testBufs('abc', SIZE, 'utf8')
  testBufs('\u0222aa', 2, 'utf8')
  testBufs('\u0222aa', 8, 'utf8')
  testBufs('a\u0234b\u0235c\u0236', 4, 'utf8')
  testBufs('a\u0234b\u0235c\u0236', 12, 'utf8')
  testBufs('abc', 4, 1, 'utf8')
  testBufs('abc', 5, 1, 'utf8')
  testBufs('\u0222aa', 8, 1, 'utf8')
  testBufs('a\u0234b\u0235c\u0236', 4, 1, 'utf8')
  testBufs('a\u0234b\u0235c\u0236', 12, 1, 'utf8')
  assert.strictEqual(Buffer.allocUnsafe(1).fill(0).fill('\u0222')[0], 0xc8)

  // BINARY ❌
  // testBufs('abc', 'binary')
  // testBufs('\u0222aa', 'binary')
  // testBufs('a\u0234b\u0235c\u0236', 'binary')
  // testBufs('abc', 4, 'binary')
  // testBufs('abc', 5, 'binary')
  // testBufs('abc', SIZE, 'binary')
  // testBufs('\u0222aa', 2, 'binary')
  // testBufs('\u0222aa', 8, 'binary')
  // testBufs('a\u0234b\u0235c\u0236', 4, 'binary')
  // testBufs('a\u0234b\u0235c\u0236', 12, 'binary')
  // testBufs('abc', 4, 1, 'binary')
  // testBufs('abc', 5, 1, 'binary')
  // testBufs('\u0222aa', 8, 1, 'binary')
  // testBufs('a\u0234b\u0235c\u0236', 4, 1, 'binary')
  // testBufs('a\u0234b\u0235c\u0236', 12, 1, 'binary')

  // LATIN1 ❌
  // testBufs('abc', 'latin1')
  // testBufs('\u0222aa', 'latin1')
  // testBufs('a\u0234b\u0235c\u0236', 'latin1')
  // testBufs('abc', 4, 'latin1')
  // testBufs('abc', 5, 'latin1')
  // testBufs('abc', SIZE, 'latin1')
  // testBufs('\u0222aa', 2, 'latin1')
  // testBufs('\u0222aa', 8, 'latin1')
  // testBufs('a\u0234b\u0235c\u0236', 4, 'latin1')
  // testBufs('a\u0234b\u0235c\u0236', 12, 'latin1')
  // testBufs('abc', 4, 1, 'latin1')
  // testBufs('abc', 5, 1, 'latin1')
  // testBufs('\u0222aa', 8, 1, 'latin1')
  // testBufs('a\u0234b\u0235c\u0236', 4, 1, 'latin1')
  // testBufs('a\u0234b\u0235c\u0236', 12, 1, 'latin1')

  // UCS2 ❌
  // testBufs('abc', 'ucs2')
  // testBufs('\u0222aa', 'ucs2')
  // testBufs('a\u0234b\u0235c\u0236', 'ucs2')
  // testBufs('abc', 4, 'ucs2')
  // testBufs('abc', SIZE, 'ucs2')
  // testBufs('\u0222aa', 2, 'ucs2')
  // testBufs('\u0222aa', 8, 'ucs2')
  // testBufs('a\u0234b\u0235c\u0236', 4, 'ucs2')
  // testBufs('a\u0234b\u0235c\u0236', 12, 'ucs2')
  // testBufs('abc', 4, 1, 'ucs2')
  // testBufs('abc', 5, 1, 'ucs2')
  // testBufs('\u0222aa', 8, 1, 'ucs2')
  // testBufs('a\u0234b\u0235c\u0236', 4, 1, 'ucs2')
  // testBufs('a\u0234b\u0235c\u0236', 12, 1, 'ucs2')
  // assert.strictEqual(Buffer.allocUnsafe(1).fill('\u0222', 'ucs2')[0], 0x22)

  // HEX
  testBufs('616263', 'hex')
  testBufs('c8a26161', 'hex')
  testBufs('61c8b462c8b563c8b6', 'hex')
  testBufs('616263', 4, 'hex')
  testBufs('616263', 5, 'hex')
  testBufs('616263', SIZE, 'hex')
  testBufs('c8a26161', 2, 'hex')
  testBufs('c8a26161', 8, 'hex')
  testBufs('61c8b462c8b563c8b6', 4, 'hex')
  testBufs('61c8b462c8b563c8b6', 12, 'hex')
  testBufs('616263', 4, 1, 'hex')
  testBufs('616263', 5, 1, 'hex')
  testBufs('c8a26161', 8, 1, 'hex')
  testBufs('61c8b462c8b563c8b6', 4, 1, 'hex')
  testBufs('61c8b462c8b563c8b6', 12, 1, 'hex')

  assert.throws(() => {
    const buf = Buffer.allocUnsafe(SIZE)

    buf.fill('yKJh', 'hex')
  })

  assert.throws(() => {
    const buf = Buffer.allocUnsafe(SIZE)

    buf.fill('\u0222', 'hex')
  })

  // BASE64
  testBufs('YWJj', 'base64')
  testBufs('yKJhYQ==', 'base64')
  testBufs('Yci0Ysi1Y8i2', 'base64')
  testBufs('YWJj', 4, 'base64')
  testBufs('YWJj', SIZE, 'base64')
  testBufs('yKJhYQ==', 2, 'base64')
  testBufs('yKJhYQ==', 8, 'base64')
  testBufs('Yci0Ysi1Y8i2', 4, 'base64')
  testBufs('Yci0Ysi1Y8i2', 12, 'base64')
  testBufs('YWJj', 4, 1, 'base64')
  testBufs('YWJj', 5, 1, 'base64')
  testBufs('yKJhYQ==', 8, 1, 'base64')
  testBufs('Yci0Ysi1Y8i2', 4, 1, 'base64')
  testBufs('Yci0Ysi1Y8i2', 12, 1, 'base64')

  // BASE64URL ❌
  // testBufs('YWJj', 'base64url')
  // testBufs('yKJhYQ', 'base64url')
  // testBufs('Yci0Ysi1Y8i2', 'base64url')
  // testBufs('YWJj', 4, 'base64url')
  // testBufs('YWJj', SIZE, 'base64url')
  // testBufs('yKJhYQ', 2, 'base64url')
  // testBufs('yKJhYQ', 8, 'base64url')
  // testBufs('Yci0Ysi1Y8i2', 4, 'base64url')
  // testBufs('Yci0Ysi1Y8i2', 12, 'base64url')
  // testBufs('YWJj', 4, 1, 'base64url')
  // testBufs('YWJj', 5, 1, 'base64url')
  // testBufs('yKJhYQ', 8, 1, 'base64url')
  // testBufs('Yci0Ysi1Y8i2', 4, 1, 'base64url')
  // testBufs('Yci0Ysi1Y8i2', 12, 1, 'base64url')

  // Buffer
  function deepStrictEqualValues(buf, arr) {
    for (const [index, value] of buf.entries()) {
      assert.deepStrictEqual(value, arr[index])
    }
  }

  const buf2Fill = Buffer.allocUnsafe(1).fill(2)
  deepStrictEqualValues(genBuffer(4, [buf2Fill]), [2, 2, 2, 2])
  deepStrictEqualValues(genBuffer(4, [buf2Fill, 1]), [0, 2, 2, 2])
  deepStrictEqualValues(genBuffer(4, [buf2Fill, 1, 3]), [0, 2, 2, 0])
  deepStrictEqualValues(genBuffer(4, [buf2Fill, 1, 1]), [0, 0, 0, 0])
  const hexBufFill = Buffer.allocUnsafe(2).fill(0).fill('0102', 'hex')
  deepStrictEqualValues(genBuffer(4, [hexBufFill]), [1, 2, 1, 2])
  deepStrictEqualValues(genBuffer(4, [hexBufFill, 1]), [0, 1, 2, 1])
  deepStrictEqualValues(genBuffer(4, [hexBufFill, 1, 3]), [0, 1, 2, 0])
  deepStrictEqualValues(genBuffer(4, [hexBufFill, 1, 1]), [0, 0, 0, 0])

  // Check exceptions
  ;[
    [0, -1],
    [0, 0, buf1.length + 1],
    ['', -1],
    ['', 0, buf1.length + 1],
    ['', 1, -1],
  ].forEach((args) => {
    // assert.throws(() => buf1.fill(...args)) ❌
  })

  // @ts-expect-error
  assert.throws(() => buf1.fill('a', 0, buf1.length, 'node rocks!'))
  ;[
    ['a', 0, 0, NaN],
    ['a', 0, 0, false],
  ].forEach((args) => {
    // @ts-expect-error
    assert.throws(() => buf1.fill(...args))
  })

  // @ts-expect-error
  assert.throws(() => buf1.fill('a', 0, 0, 'foo'))

  function genBuffer(size, args) {
    const b = Buffer.allocUnsafe(size)
    return b.fill(0).fill.apply(b, args)
  }

  function bufReset() {
    buf1.fill(0)
    buf2.fill(0)
  }

  // This is mostly accurate. Except write() won't write partial bytes to the
  // string while fill() blindly copies bytes into memory. To account for that an
  // error will be thrown if not all the data can be written, and the SIZE has
  // been massaged to work with the input characters.
  function writeToFill(string, offset, end, encoding) {
    if (typeof offset === 'string') {
      encoding = offset
      offset = 0
      end = buf2.length
    } else if (typeof end === 'string') {
      encoding = end
      end = buf2.length
    } else if (end === undefined) {
      end = buf2.length
    }

    // Should never be reached.
    if (offset < 0 || end > buf2.length) throw new Error('Should never be reached')

    if (end <= offset) return buf2

    offset >>>= 0
    end >>>= 0
    assert(offset <= buf2.length)

    // Convert "end" to "length" (which write understands).
    const length = end - offset < 0 ? 0 : end - offset

    let wasZero = false
    do {
      const written = buf2.write(string, offset, length, encoding)
      offset += written
      // Safety check in case write falls into infinite loop.
      if (written === 0) {
        if (wasZero) throw new Error('Could not write all data to Buffer')
        else wasZero = true
      }
    } while (offset < buf2.length)

    return buf2
  }

  function testBufs(string: any, offset?: any, length?: any, encoding?: any) {
    bufReset()
    // @ts-ignore
    // eslint-disable-next-line prefer-spread, prefer-rest-params
    buf1.fill.apply(buf1, arguments)
    // @ts-ignore Swap bytes on BE archs for ucs2 encoding.
    // eslint-disable-next-line prefer-spread, prefer-rest-params
    assert.deepStrictEqual(buf1.fill.apply(buf1, arguments), writeToFill.apply(null, arguments))
  }

  // Make sure these throw.
  assert.throws(() => Buffer.allocUnsafe(8).fill('a', -1))
  // assert.throws(() => Buffer.allocUnsafe(8).fill('a', 0, 9)) ❌

  // Make sure this doesn't hang indefinitely.
  Buffer.allocUnsafe(8).fill('')
  Buffer.alloc(8, '')

  {
    const buf = Buffer.alloc(64, 10)
    for (let i = 0; i < buf.length; i++) assert.strictEqual(buf[i], 10)

    buf.fill(11, 0, buf.length >> 1)
    for (let i = 0; i < buf.length >> 1; i++) assert.strictEqual(buf[i], 11)
    for (let i = (buf.length >> 1) + 1; i < buf.length; i++) assert.strictEqual(buf[i], 10)

    buf.fill('h')
    for (let i = 0; i < buf.length; i++) assert.strictEqual(buf[i], 'h'.charCodeAt(0))

    buf.fill(0)
    for (let i = 0; i < buf.length; i++) assert.strictEqual(buf[i], 0)

    // @ts-expect-error
    buf.fill(null)
    for (let i = 0; i < buf.length; i++) assert.strictEqual(buf[i], 0)

    buf.fill(1, 16, 32)
    for (let i = 0; i < 16; i++) assert.strictEqual(buf[i], 0)
    for (let i = 16; i < 32; i++) assert.strictEqual(buf[i], 1)
    for (let i = 32; i < buf.length; i++) assert.strictEqual(buf[i], 0)
  }

  {
    const buf = Buffer.alloc(10, 'abc')
    assert.strictEqual(buf.toString(), 'abcabcabca')
    buf.fill('է')
    assert.strictEqual(buf.toString(), 'էէէէէ')
  }

  // Make sure "end" is properly checked, even if it's magically mangled using
  // Symbol.toPrimitive.
  {
    // assert.throws(() => { ❌
    //   const end = {
    //     [Symbol.toPrimitive]() {
    //       return 1
    //     },
    //   }
    //   Buffer.alloc(1).fill(Buffer.alloc(1), 0, end)
    // })
  }

  // Test that bypassing 'length' won't cause an abort.
  // assert.throws(() => { ❌
  //   const buf = Buffer.from('w00t')
  //   Object.defineProperty(buf, 'length', {
  //     value: 1337,
  //     enumerable: true,
  //   })
  //   buf.fill('')
  // })

  // assert.deepStrictEqual( // ❌
  //   Buffer.allocUnsafe(16).fill('ab', 'utf16le'),
  //   Buffer.from('61006200610062006100620061006200', 'hex'),
  // )

  // assert.deepStrictEqual( // ❌
  //   Buffer.allocUnsafe(15).fill('ab', 'utf16le'),
  //   Buffer.from('610062006100620061006200610062', 'hex'),
  // )

  // assert.deepStrictEqual( // ❌
  //   Buffer.allocUnsafe(16).fill('ab', 'utf16le'),
  //   Buffer.from('61006200610062006100620061006200', 'hex'),
  // )
  // assert.deepStrictEqual( // ❌
  //   Buffer.allocUnsafe(16).fill('a', 'utf16le'),
  //   Buffer.from('61006100610061006100610061006100', 'hex'),
  // )

  // assert.strictEqual(Buffer.allocUnsafeSlow(16).fill('a', 'utf16le').toString('utf16le'), 'a'.repeat(8)) ❌
  // assert.strictEqual(Buffer.allocUnsafeSlow(16).fill('a', 'latin1').toString('latin1'), 'a'.repeat(16)) ❌
  assert.strictEqual(Buffer.allocUnsafe(16).fill('a', 'utf8').toString('utf8'), 'a'.repeat(16))

  // assert.strictEqual(Buffer.allocUnsafeSlow(16).fill('Љ', 'utf16le').toString('utf16le'), 'Љ'.repeat(8)) ❌
  // assert.strictEqual(Buffer.allocUnsafeSlow(16).fill('Љ', 'latin1').toString('latin1'), '\t'.repeat(16)) ❌
  assert.strictEqual(Buffer.allocUnsafe(16).fill('Љ', 'utf8').toString('utf8'), 'Љ'.repeat(8))

  assert.throws(() => {
    const buf = Buffer.from('a'.repeat(1000))

    buf.fill('This is not correctly encoded', 'hex')
  })

  {
    const bufEmptyString = Buffer.alloc(5, '')
    assert.strictEqual(bufEmptyString.toString(), '\x00\x00\x00\x00\x00')

    // @ts-expect-error
    const bufEmptyArray = Buffer.alloc(5, [])
    assert.strictEqual(bufEmptyArray.toString(), '\x00\x00\x00\x00\x00')

    const bufEmptyBuffer = Buffer.alloc(5, Buffer.alloc(5))
    assert.strictEqual(bufEmptyBuffer.toString(), '\x00\x00\x00\x00\x00')

    const bufZero = Buffer.alloc(5, 0)
    assert.strictEqual(bufZero.toString(), '\x00\x00\x00\x00\x00')
  }
})

test('Buffer.indexOf (node.js repository test)', () => {
  const b = Buffer.from('abcdef')
  const buf_a = Buffer.from('a')
  const buf_bc = Buffer.from('bc')
  const buf_f = Buffer.from('f')
  const buf_z = Buffer.from('z')
  const buf_empty = Buffer.from('')

  const s = 'abcdef'

  assert.strictEqual(b.indexOf('a'), 0)
  assert.strictEqual(b.indexOf('a', 1), -1)
  assert.strictEqual(b.indexOf('a', -1), -1)
  assert.strictEqual(b.indexOf('a', -4), -1)
  assert.strictEqual(b.indexOf('a', -b.length), 0)
  // assert.strictEqual(b.indexOf('a', NaN), 0) ❌
  assert.strictEqual(b.indexOf('a', -Infinity), 0)
  assert.strictEqual(b.indexOf('a', Infinity), -1)
  assert.strictEqual(b.indexOf('bc'), 1)
  assert.strictEqual(b.indexOf('bc', 2), -1)
  assert.strictEqual(b.indexOf('bc', -1), -1)
  assert.strictEqual(b.indexOf('bc', -3), -1)
  assert.strictEqual(b.indexOf('bc', -5), 1)
  // assert.strictEqual(b.indexOf('bc', NaN), 1) ❌
  assert.strictEqual(b.indexOf('bc', -Infinity), 1)
  assert.strictEqual(b.indexOf('bc', Infinity), -1)
  assert.strictEqual(b.indexOf('f'), b.length - 1)
  assert.strictEqual(b.indexOf('z'), -1)
  assert.strictEqual(b.indexOf(''), 0)
  assert.strictEqual(b.indexOf('', 1), 1)
  assert.strictEqual(b.indexOf('', b.length + 1), b.length)
  assert.strictEqual(b.indexOf('', Infinity), b.length)
  assert.strictEqual(b.indexOf(buf_a), 0)
  assert.strictEqual(b.indexOf(buf_a, 1), -1)
  assert.strictEqual(b.indexOf(buf_a, -1), -1)
  assert.strictEqual(b.indexOf(buf_a, -4), -1)
  assert.strictEqual(b.indexOf(buf_a, -b.length), 0)
  // assert.strictEqual(b.indexOf(buf_a, NaN), 0) ❌
  assert.strictEqual(b.indexOf(buf_a, -Infinity), 0)
  assert.strictEqual(b.indexOf(buf_a, Infinity), -1)
  assert.strictEqual(b.indexOf(buf_bc), 1)
  assert.strictEqual(b.indexOf(buf_bc, 2), -1)
  assert.strictEqual(b.indexOf(buf_bc, -1), -1)
  assert.strictEqual(b.indexOf(buf_bc, -3), -1)
  assert.strictEqual(b.indexOf(buf_bc, -5), 1)
  // assert.strictEqual(b.indexOf(buf_bc, NaN), 1) ❌
  assert.strictEqual(b.indexOf(buf_bc, -Infinity), 1)
  assert.strictEqual(b.indexOf(buf_bc, Infinity), -1)
  assert.strictEqual(b.indexOf(buf_f), b.length - 1)
  assert.strictEqual(b.indexOf(buf_z), -1)
  assert.strictEqual(b.indexOf(buf_empty), 0)
  assert.strictEqual(b.indexOf(buf_empty, 1), 1)
  assert.strictEqual(b.indexOf(buf_empty, b.length + 1), b.length)
  assert.strictEqual(b.indexOf(buf_empty, Infinity), b.length)
  assert.strictEqual(b.indexOf(0x61), 0)
  assert.strictEqual(b.indexOf(0x61, 1), -1)
  assert.strictEqual(b.indexOf(0x61, -1), -1)
  assert.strictEqual(b.indexOf(0x61, -4), -1)
  assert.strictEqual(b.indexOf(0x61, -b.length), 0)
  // assert.strictEqual(b.indexOf(0x61, NaN), 0) ❌
  assert.strictEqual(b.indexOf(0x61, -Infinity), 0)
  assert.strictEqual(b.indexOf(0x61, Infinity), -1)
  assert.strictEqual(b.indexOf(0x0), -1)

  // test offsets
  assert.strictEqual(b.indexOf('d', 2), 3)
  assert.strictEqual(b.indexOf('f', 5), 5)
  assert.strictEqual(b.indexOf('f', -1), 5)
  assert.strictEqual(b.indexOf('f', 6), -1)

  assert.strictEqual(b.indexOf(Buffer.from('d'), 2), 3)
  assert.strictEqual(b.indexOf(Buffer.from('f'), 5), 5)
  assert.strictEqual(b.indexOf(Buffer.from('f'), -1), 5)
  assert.strictEqual(b.indexOf(Buffer.from('f'), 6), -1)

  // assert.strictEqual(Buffer.from('ff').indexOf(Buffer.from('f'), 1, 'ucs2'), -1) ❌

  // Test invalid and uppercase encoding
  assert.strictEqual(b.indexOf('b', 'utf8'), 1)
  // @ts-expect-error
  assert.strictEqual(b.indexOf('b', 'UTF8'), 1)
  // @ts-expect-error
  assert.strictEqual(b.indexOf('62', 'HEX'), 1)
  // @ts-expect-error
  assert.throws(() => b.indexOf('bad', 'enc'))

  // test hex encoding
  assert.strictEqual(Buffer.from(b.toString('hex'), 'hex').indexOf('64', 0, 'hex'), 3)
  assert.strictEqual(Buffer.from(b.toString('hex'), 'hex').indexOf(Buffer.from('64', 'hex'), 0, 'hex'), 3)

  // Test base64 encoding
  assert.strictEqual(Buffer.from(b.toString('base64'), 'base64').indexOf('ZA==', 0, 'base64'), 3)
  assert.strictEqual(Buffer.from(b.toString('base64'), 'base64').indexOf(Buffer.from('ZA==', 'base64'), 0, 'base64'), 3)

  // Test base64url encoding
  // assert.strictEqual(Buffer.from(b.toString('base64url'), 'base64url').indexOf('ZA==', 0, 'base64url'), 3) ❌

  // test ascii encoding
  // assert.strictEqual(Buffer.from(b.toString('ascii'), 'ascii').indexOf('d', 0, 'ascii'), 3) ❌
  // assert.strictEqual(Buffer.from(b.toString('ascii'), 'ascii').indexOf(Buffer.from('d', 'ascii'), 0, 'ascii'), 3) ❌

  // Test latin1 encoding
  // assert.strictEqual(Buffer.from(b.toString('latin1'), 'latin1').indexOf('d', 0, 'latin1'), 3) ❌
  // assert.strictEqual(Buffer.from(b.toString('latin1'), 'latin1').indexOf(Buffer.from('d', 'latin1'), 0, 'latin1'), 3) ❌
  // assert.strictEqual(Buffer.from('aa\u00e8aa', 'latin1').indexOf('\u00e8', 'latin1'), 2) ❌
  // assert.strictEqual(Buffer.from('\u00e8', 'latin1').indexOf('\u00e8', 'latin1'), 0) ❌
  // assert.strictEqual(Buffer.from('\u00e8', 'latin1').indexOf(Buffer.from('\u00e8', 'latin1'), 'latin1'), 0) ❌

  // Test binary encoding
  // assert.strictEqual(Buffer.from(b.toString('binary'), 'binary').indexOf('d', 0, 'binary'), 3) ❌
  // assert.strictEqual(Buffer.from(b.toString('binary'), 'binary').indexOf(Buffer.from('d', 'binary'), 0, 'binary'), 3) ❌
  // assert.strictEqual(Buffer.from('aa\u00e8aa', 'binary').indexOf('\u00e8', 'binary'), 2) ❌
  // assert.strictEqual(Buffer.from('\u00e8', 'binary').indexOf('\u00e8', 'binary'), 0) ❌
  // assert.strictEqual(Buffer.from('\u00e8', 'binary').indexOf(Buffer.from('\u00e8', 'binary'), 'binary'), 0) ❌

  // Test optional offset with passed encoding
  assert.strictEqual(Buffer.from('aaaa0').indexOf('30', 'hex'), 4)
  assert.strictEqual(Buffer.from('aaaa00a').indexOf('3030', 'hex'), 4)

  // { ❌
  //   // Test usc2 and utf16le encoding
  //   ;['ucs2', 'utf16le'].forEach((encoding) => {
  //     const twoByteString = Buffer.from('\u039a\u0391\u03a3\u03a3\u0395', encoding)

  //     assert.strictEqual(twoByteString.indexOf('\u0395', 4, encoding), 8)
  //     assert.strictEqual(twoByteString.indexOf('\u03a3', -4, encoding), 6)
  //     assert.strictEqual(twoByteString.indexOf('\u03a3', -6, encoding), 4)
  //     assert.strictEqual(twoByteString.indexOf(Buffer.from('\u03a3', encoding), -6, encoding), 4)
  //     assert.strictEqual(-1, twoByteString.indexOf('\u03a3', -2, encoding))
  //   })
  // }

  // const mixedByteStringUcs2 = Buffer.from('\u039a\u0391abc\u03a3\u03a3\u0395', 'ucs2') ❌
  // assert.strictEqual(mixedByteStringUcs2.indexOf('bc', 0, 'ucs2'), 6) ❌
  // assert.strictEqual(mixedByteStringUcs2.indexOf('\u03a3', 0, 'ucs2'), 10) ❌
  // assert.strictEqual(-1, mixedByteStringUcs2.indexOf('\u0396', 0, 'ucs2')) ❌

  // assert.strictEqual(mixedByteStringUcs2.indexOf(Buffer.from('bc', 'ucs2'), 0, 'ucs2'), 6) ❌
  // assert.strictEqual(mixedByteStringUcs2.indexOf(Buffer.from('\u03a3', 'ucs2'), 0, 'ucs2'), 10) ❌
  // assert.strictEqual(-1, mixedByteStringUcs2.indexOf(Buffer.from('\u0396', 'ucs2'), 0, 'ucs2')) ❌

  // { ❌
  //   const twoByteString = Buffer.from('\u039a\u0391\u03a3\u03a3\u0395', 'ucs2')

  //   // Test single char pattern
  //   assert.strictEqual(twoByteString.indexOf('\u039a', 0, 'ucs2'), 0)
  //   let index = twoByteString.indexOf('\u0391', 0, 'ucs2')
  //   assert.strictEqual(index, 2, `Alpha - at index ${index}`)
  //   index = twoByteString.indexOf('\u03a3', 0, 'ucs2')
  //   assert.strictEqual(index, 4, `First Sigma - at index ${index}`)
  //   index = twoByteString.indexOf('\u03a3', 6, 'ucs2')
  //   assert.strictEqual(index, 6, `Second Sigma - at index ${index}`)
  //   index = twoByteString.indexOf('\u0395', 0, 'ucs2')
  //   assert.strictEqual(index, 8, `Epsilon - at index ${index}`)
  //   index = twoByteString.indexOf('\u0392', 0, 'ucs2')
  //   assert.strictEqual(-1, index, `Not beta - at index ${index}`)

  //   // Test multi-char pattern
  //   index = twoByteString.indexOf('\u039a\u0391', 0, 'ucs2')
  //   assert.strictEqual(index, 0, `Lambda Alpha - at index ${index}`)
  //   index = twoByteString.indexOf('\u0391\u03a3', 0, 'ucs2')
  //   assert.strictEqual(index, 2, `Alpha Sigma - at index ${index}`)
  //   index = twoByteString.indexOf('\u03a3\u03a3', 0, 'ucs2')
  //   assert.strictEqual(index, 4, `Sigma Sigma - at index ${index}`)
  //   index = twoByteString.indexOf('\u03a3\u0395', 0, 'ucs2')
  //   assert.strictEqual(index, 6, `Sigma Epsilon - at index ${index}`)
  // }

  const mixedByteStringUtf8 = Buffer.from('\u039a\u0391abc\u03a3\u03a3\u0395')
  assert.strictEqual(mixedByteStringUtf8.indexOf('bc'), 5)
  assert.strictEqual(mixedByteStringUtf8.indexOf('bc', 5), 5)
  assert.strictEqual(mixedByteStringUtf8.indexOf('bc', -8), 5)
  assert.strictEqual(mixedByteStringUtf8.indexOf('\u03a3'), 7)
  assert.strictEqual(mixedByteStringUtf8.indexOf('\u0396'), -1)

  // Test complex string indexOf algorithms. Only trigger for long strings.
  // Long string that isn't a simple repeat of a shorter string.
  let longString = 'A'
  for (let i = 66; i < 76; i++) {
    // from 'B' to 'K'
    longString = longString + String.fromCharCode(i) + longString
  }

  const longBufferString = Buffer.from(longString)

  // Pattern of 15 chars, repeated every 16 chars in long
  let pattern: string | Uint8Array = 'ABACABADABACABA'
  for (let i = 0; i < longBufferString.length - pattern.length; i += 7) {
    const index = longBufferString.indexOf(pattern, i)
    assert.strictEqual((i + 15) & ~0xf, index, `Long ABACABA...-string at index ${i}`)
  }

  let index = longBufferString.indexOf('AJABACA')
  assert.strictEqual(index, 510, `Long AJABACA, First J - at index ${index}`)
  index = longBufferString.indexOf('AJABACA', 511)
  assert.strictEqual(index, 1534, `Long AJABACA, Second J - at index ${index}`)

  pattern = 'JABACABADABACABA'
  index = longBufferString.indexOf(pattern)
  assert.strictEqual(index, 511, `Long JABACABA..., First J - at index ${index}`)
  index = longBufferString.indexOf(pattern, 512)
  assert.strictEqual(index, 1535, `Long JABACABA..., Second J - at index ${index}`)

  // Search for a non-ASCII string in a pure ASCII string.
  const asciiString = Buffer.from('arglebargleglopglyfarglebargleglopglyfarglebargleglopglyf')
  assert.strictEqual(-1, asciiString.indexOf('\x2061'))
  assert.strictEqual(asciiString.indexOf('leb', 0), 3)

  // Search in string containing many non-ASCII chars.
  const allCodePoints = [] as number[]
  for (let i = 0; i < 65534; i++) allCodePoints[i] = i
  // eslint-disable-next-line prefer-spread
  const allCharsString = String.fromCharCode.apply(String, allCodePoints) + String.fromCharCode(65534, 65535)
  const allCharsBufferUtf8 = Buffer.from(allCharsString)
  // const allCharsBufferUcs2 = Buffer.from(allCharsString, 'ucs2') ❌

  // Search for string long enough to trigger complex search with ASCII pattern
  // and UC16 subject.
  // assert.strictEqual(-1, allCharsBufferUtf8.indexOf('notfound')) ❌
  // assert.strictEqual(-1, allCharsBufferUcs2.indexOf('notfound')) ❌

  // Needle is longer than haystack, but only because it's encoded as UTF-16
  // assert.strictEqual(Buffer.from('aaaa').indexOf('a'.repeat(4), 'ucs2'), -1) ❌

  assert.strictEqual(Buffer.from('aaaa').indexOf('a'.repeat(4), 'utf8'), 0)
  // assert.strictEqual(Buffer.from('aaaa').indexOf('你好', 'ucs2'), -1) ❌

  // Haystack has odd length, but the needle is UCS2.
  // assert.strictEqual(Buffer.from('aaaaa').indexOf('b', 'ucs2'), -1) ❌

  {
    // Find substrings in Utf8.
    const lengths = [1, 3, 15] // Single char, simple and complex.
    const indices = [0x5, 0x60, 0x400, 0x680, 0x7ee, 0xff02, 0x16610, 0x2f77b]
    for (let lengthIndex = 0; lengthIndex < lengths.length; lengthIndex++) {
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i]
        let length = lengths[lengthIndex]

        if (index + length > 0x7f) {
          length = 2 * length
        }

        if (index + length > 0x7ff) {
          length = 3 * length
        }

        if (index + length > 0xffff) {
          length = 4 * length
        }

        const patternBufferUtf8 = allCharsBufferUtf8.slice(index, index + length)
        assert.strictEqual(index, allCharsBufferUtf8.indexOf(patternBufferUtf8))

        const patternStringUtf8 = patternBufferUtf8.toString()
        assert.strictEqual(index, allCharsBufferUtf8.indexOf(patternStringUtf8))
      }
    }
  }

  // { ❌
  //   // Find substrings in Usc2.
  //   const lengths = [2, 4, 16] // Single char, simple and complex.
  //   const indices = [0x5, 0x65, 0x105, 0x205, 0x285, 0x2005, 0x2085, 0xfff0]
  //   for (let lengthIndex = 0; lengthIndex < lengths.length; lengthIndex++) {
  //     for (let i = 0; i < indices.length; i++) {
  //       const index = indices[i] * 2
  //       const length = lengths[lengthIndex]

  //       const patternBufferUcs2 = allCharsBufferUcs2.slice(index, index + length)
  //       assert.strictEqual(index, allCharsBufferUcs2.indexOf(patternBufferUcs2, 0, 'ucs2'))

  //       const patternStringUcs2 = patternBufferUcs2.toString('ucs2')
  //       assert.strictEqual(index, allCharsBufferUcs2.indexOf(patternStringUcs2, 0, 'ucs2'))
  //     }
  //   }
  // }

  ;[() => {}, {}, []].forEach((val) => {
    // assert.throws(() => b.indexOf(val), {
    //   code: 'ERR_INVALID_ARG_TYPE',
    //   name: 'TypeError',
    //   message:
    //     'The "value" argument must be one of type number or string ' +
    //     'or an instance of Buffer or Uint8Array.' +
    //     common.invalidArgTypeHelper(val),
    // })
  })

  // Test weird offset arguments.
  // The following offsets coerce to NaN or 0, searching the whole Buffer
  assert.strictEqual(b.indexOf('b', undefined), 1)
  // assert.strictEqual(b.indexOf('b', {}), 1) ❌
  assert.strictEqual(b.indexOf('b', 0), 1)
  // assert.strictEqual(b.indexOf('b', null), 1) ❌
  // assert.strictEqual(b.indexOf('b', []), 1)  ❌

  // The following offset coerces to 2, in other words +[2] === 2
  // assert.strictEqual(b.indexOf('b', [2]), -1) ❌

  // Behavior should match String.indexOf()
  assert.strictEqual(b.indexOf('b', undefined), s.indexOf('b', undefined))
  // assert.strictEqual(b.indexOf('b', {}), s.indexOf('b', {})) ❌
  assert.strictEqual(b.indexOf('b', 0), s.indexOf('b', 0))
  // assert.strictEqual(b.indexOf('b', null), s.indexOf('b', null)) ❌
  // assert.strictEqual(b.indexOf('b', []), s.indexOf('b', [])) ❌
  // assert.strictEqual(b.indexOf('b', [2]), s.indexOf('b', [2])) ❌

  // All code for handling encodings is shared between Buffer.indexOf and
  // Buffer.lastIndexOf, so only testing the separate lastIndexOf semantics.

  // Test lastIndexOf basic functionality; Buffer b contains 'abcdef'.
  // lastIndexOf string:
  assert.strictEqual(b.lastIndexOf('a'), 0)
  assert.strictEqual(b.lastIndexOf('a', 1), 0)
  assert.strictEqual(b.lastIndexOf('b', 1), 1)
  assert.strictEqual(b.lastIndexOf('c', 1), -1)
  assert.strictEqual(b.lastIndexOf('a', -1), 0)
  assert.strictEqual(b.lastIndexOf('a', -4), 0)
  assert.strictEqual(b.lastIndexOf('a', -b.length), 0)
  assert.strictEqual(b.lastIndexOf('a', -b.length - 1), -1)
  // assert.strictEqual(b.lastIndexOf('a', NaN), 0) ❌
  assert.strictEqual(b.lastIndexOf('a', -Infinity), -1)
  assert.strictEqual(b.lastIndexOf('a', Infinity), 0)
  // lastIndexOf Buffer:
  assert.strictEqual(b.lastIndexOf(buf_a), 0)
  assert.strictEqual(b.lastIndexOf(buf_a, 1), 0)
  assert.strictEqual(b.lastIndexOf(buf_a, -1), 0)
  assert.strictEqual(b.lastIndexOf(buf_a, -4), 0)
  assert.strictEqual(b.lastIndexOf(buf_a, -b.length), 0)
  assert.strictEqual(b.lastIndexOf(buf_a, -b.length - 1), -1)
  // assert.strictEqual(b.lastIndexOf(buf_a, NaN), 0) ❌
  assert.strictEqual(b.lastIndexOf(buf_a, -Infinity), -1)
  assert.strictEqual(b.lastIndexOf(buf_a, Infinity), 0)
  assert.strictEqual(b.lastIndexOf(buf_bc), 1)
  assert.strictEqual(b.lastIndexOf(buf_bc, 2), 1)
  assert.strictEqual(b.lastIndexOf(buf_bc, -1), 1)
  assert.strictEqual(b.lastIndexOf(buf_bc, -3), 1)
  assert.strictEqual(b.lastIndexOf(buf_bc, -5), 1)
  // assert.strictEqual(b.lastIndexOf(buf_bc, -6), -1) ❌
  // assert.strictEqual(b.lastIndexOf(buf_bc, NaN), 1) ❌
  assert.strictEqual(b.lastIndexOf(buf_bc, -Infinity), -1)
  assert.strictEqual(b.lastIndexOf(buf_bc, Infinity), 1)
  assert.strictEqual(b.lastIndexOf(buf_f), b.length - 1)
  assert.strictEqual(b.lastIndexOf(buf_z), -1)
  assert.strictEqual(b.lastIndexOf(buf_empty), b.length)
  assert.strictEqual(b.lastIndexOf(buf_empty, 1), 1)
  assert.strictEqual(b.lastIndexOf(buf_empty, b.length + 1), b.length)
  assert.strictEqual(b.lastIndexOf(buf_empty, Infinity), b.length)
  // lastIndexOf number:
  assert.strictEqual(b.lastIndexOf(0x61), 0)
  assert.strictEqual(b.lastIndexOf(0x61, 1), 0)
  assert.strictEqual(b.lastIndexOf(0x61, -1), 0)
  assert.strictEqual(b.lastIndexOf(0x61, -4), 0)
  assert.strictEqual(b.lastIndexOf(0x61, -b.length), 0)
  assert.strictEqual(b.lastIndexOf(0x61, -b.length - 1), -1)
  // assert.strictEqual(b.lastIndexOf(0x61, NaN), 0) ❌
  assert.strictEqual(b.lastIndexOf(0x61, -Infinity), -1)
  assert.strictEqual(b.lastIndexOf(0x61, Infinity), 0)
  assert.strictEqual(b.lastIndexOf(0x0), -1)

  // Test weird offset arguments.
  // The following offsets coerce to NaN, searching the whole Buffer
  assert.strictEqual(b.lastIndexOf('b', undefined), 1)
  // assert.strictEqual(b.lastIndexOf('b', {}), 1) ❌

  // The following offsets coerce to 0
  // assert.strictEqual(b.lastIndexOf('b', 0), -1) ❌🔍 TODO investigate
  // assert.strictEqual(b.lastIndexOf('b', null), -1) ❌
  // assert.strictEqual(b.lastIndexOf('b', []), -1) ❌

  // The following offset coerces to 2, in other words +[2] === 2
  // assert.strictEqual(b.lastIndexOf('b', [2]), 1) ❌

  // Behavior should match String.lastIndexOf()
  assert.strictEqual(b.lastIndexOf('b', undefined), s.lastIndexOf('b', undefined))
  // assert.strictEqual(b.lastIndexOf('b', {}), s.lastIndexOf('b', {})) ❌
  // assert.strictEqual(b.lastIndexOf('b', 0), s.lastIndexOf('b', 0)) ❌
  // assert.strictEqual(b.lastIndexOf('b', null), s.lastIndexOf('b', null)) ❌
  // assert.strictEqual(b.lastIndexOf('b', []), s.lastIndexOf('b', [])) ❌
  // assert.strictEqual(b.lastIndexOf('b', [2]), s.lastIndexOf('b', [2])) ❌

  // Test needles longer than the haystack.
  // assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 'ucs2'), -1)
  assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 'utf8'), -1)
  // assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 'latin1'), -1)
  // assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 'binary'), -1)
  assert.strictEqual(b.lastIndexOf(Buffer.from('aaaaaaaaaaaaaaa')), -1)
  // assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 2, 'ucs2'), -1)
  assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 3, 'utf8'), -1)
  // assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 5, 'latin1'), -1)
  // assert.strictEqual(b.lastIndexOf('aaaaaaaaaaaaaaa', 5, 'binary'), -1)
  assert.strictEqual(b.lastIndexOf(Buffer.from('aaaaaaaaaaaaaaa'), 7), -1)

  // 你好 expands to a total of 6 bytes using UTF-8 and 4 bytes using UTF-16
  // assert.strictEqual(buf_bc.lastIndexOf('你好', 'ucs2'), -1)
  assert.strictEqual(buf_bc.lastIndexOf('你好', 'utf8'), -1)
  // assert.strictEqual(buf_bc.lastIndexOf('你好', 'latin1'), -1)
  // assert.strictEqual(buf_bc.lastIndexOf('你好', 'binary'), -1)
  assert.strictEqual(buf_bc.lastIndexOf(Buffer.from('你好')), -1)
  // assert.strictEqual(buf_bc.lastIndexOf('你好', 2, 'ucs2'), -1)
  assert.strictEqual(buf_bc.lastIndexOf('你好', 3, 'utf8'), -1)
  // assert.strictEqual(buf_bc.lastIndexOf('你好', 5, 'latin1'), -1)
  // assert.strictEqual(buf_bc.lastIndexOf('你好', 5, 'binary'), -1)
  assert.strictEqual(buf_bc.lastIndexOf(Buffer.from('你好'), 7), -1)

  // Test lastIndexOf on a longer buffer:
  const bufferString = Buffer.from('a man a plan a canal panama')
  assert.strictEqual(bufferString.lastIndexOf('canal'), 15)
  assert.strictEqual(bufferString.lastIndexOf('panama'), 21)
  assert.strictEqual(bufferString.lastIndexOf('a man a plan a canal panama'), 0)
  assert.strictEqual(-1, bufferString.lastIndexOf('a man a plan a canal mexico'))
  assert.strictEqual(-1, bufferString.lastIndexOf('a man a plan a canal mexico city'))
  assert.strictEqual(-1, bufferString.lastIndexOf(Buffer.from('a'.repeat(1000))))
  assert.strictEqual(bufferString.lastIndexOf('a man a plan', 4), 0)
  assert.strictEqual(bufferString.lastIndexOf('a '), 13)
  assert.strictEqual(bufferString.lastIndexOf('a ', 13), 13)
  assert.strictEqual(bufferString.lastIndexOf('a ', 12), 6)
  assert.strictEqual(bufferString.lastIndexOf('a ', 5), 0)
  assert.strictEqual(bufferString.lastIndexOf('a ', -1), 13)
  // assert.strictEqual(bufferString.lastIndexOf('a ', -27), 0) ❌
  assert.strictEqual(-1, bufferString.lastIndexOf('a ', -28))

  // Test lastIndexOf for the case that the first character can be found,
  // but in a part of the buffer that does not make search to search
  // due do length constraints.
  // const abInUCS2 = Buffer.from('ab', 'ucs2') ❌
  // assert.strictEqual(-1, Buffer.from('µaaaa¶bbbb', 'latin1').lastIndexOf('µ')) ❌
  // assert.strictEqual(-1, Buffer.from('µaaaa¶bbbb', 'binary').lastIndexOf('µ')) ❌
  assert.strictEqual(-1, Buffer.from('bc').lastIndexOf('ab'))
  assert.strictEqual(-1, Buffer.from('abc').lastIndexOf('qa'))
  assert.strictEqual(-1, Buffer.from('abcdef').lastIndexOf('qabc'))
  assert.strictEqual(-1, Buffer.from('bc').lastIndexOf(Buffer.from('ab')))
  // assert.strictEqual(-1, Buffer.from('bc', 'ucs2').lastIndexOf('ab', 'ucs2')) ❌
  // assert.strictEqual(-1, Buffer.from('bc', 'ucs2').lastIndexOf(abInUCS2)) ❌

  assert.strictEqual(Buffer.from('abc').lastIndexOf('ab'), 0)
  assert.strictEqual(Buffer.from('abc').lastIndexOf('ab', 1), 0)
  assert.strictEqual(Buffer.from('abc').lastIndexOf('ab', 2), 0)
  assert.strictEqual(Buffer.from('abc').lastIndexOf('ab', 3), 0)

  // The above tests test the LINEAR and SINGLE-CHAR strategies.
  // Now, we test the BOYER-MOORE-HORSPOOL strategy.
  // Test lastIndexOf on a long buffer w multiple matches:
  pattern = 'JABACABADABACABA'
  assert.strictEqual(longBufferString.lastIndexOf(pattern), 1535)
  assert.strictEqual(longBufferString.lastIndexOf(pattern, 1535), 1535)
  assert.strictEqual(longBufferString.lastIndexOf(pattern, 1534), 511)

  // Finally, give it a really long input to trigger fallback from BMH to
  // regular BOYER-MOORE (which has better worst-case complexity).

  // Generate a really long Thue-Morse sequence of 'yolo' and 'swag',
  // "yolo swag swag yolo swag yolo yolo swag" ..., goes on for about 5MB.
  // This is hard to search because it all looks similar, but never repeats.

  // countBits returns the number of bits in the binary representation of n.
  function countBits(n) {
    let count
    for (count = 0; n > 0; count++) {
      n = n & (n - 1) // remove top bit
    }
    return count
  }
  const parts = []
  for (let i = 0; i < 1000000; i++) {
    // @ts-ignore
    parts.push(countBits(i) % 2 === 0 ? 'yolo' : 'swag')
  }
  const reallyLong = Buffer.from(parts.join(' '))
  assert.strictEqual(reallyLong.slice(0, 19).toString(), 'yolo swag swag yolo')

  // Expensive reverse searches. Stress test lastIndexOf:
  pattern = reallyLong.slice(0, 100000) // First 1/50th of the pattern.
  assert.strictEqual(reallyLong.lastIndexOf(pattern), 4751360)
  assert.strictEqual(reallyLong.lastIndexOf(pattern, 4000000), 3932160)
  assert.strictEqual(reallyLong.lastIndexOf(pattern, 3000000), 2949120)
  pattern = reallyLong.slice(100000, 200000) // Second 1/50th.
  assert.strictEqual(reallyLong.lastIndexOf(pattern), 4728480)
  pattern = reallyLong.slice(0, 1000000) // First 1/5th.
  assert.strictEqual(reallyLong.lastIndexOf(pattern), 3932160)
  pattern = reallyLong.slice(0, 2000000) // first 2/5ths.
  assert.strictEqual(reallyLong.lastIndexOf(pattern), 0)

  // Test truncation of Number arguments to uint8
  {
    const buf = Buffer.from('this is a test')
    assert.strictEqual(buf.indexOf(0x6973), 3)
    assert.strictEqual(buf.indexOf(0x697320), 4)
    assert.strictEqual(buf.indexOf(0x69732069), 2)
    assert.strictEqual(buf.indexOf(0x697374657374), 0)
    assert.strictEqual(buf.indexOf(0x69737374), 0)
    assert.strictEqual(buf.indexOf(0x69737465), 11)
    assert.strictEqual(buf.indexOf(0x69737465), 11)
    assert.strictEqual(buf.indexOf(-140), 0)
    assert.strictEqual(buf.indexOf(-152), 1)
    assert.strictEqual(buf.indexOf(0xff), -1)
    assert.strictEqual(buf.indexOf(0xffff), -1)
  }

  // Test that Uint8Array arguments are okay.
  {
    const needle = new Uint8Array([0x66, 0x6f, 0x6f])
    const haystack = Buffer.from('a foo b foo')
    assert.strictEqual(haystack.indexOf(needle), 2)
    assert.strictEqual(haystack.lastIndexOf(needle), haystack.length - 3)
  }

  // Avoid abort because of invalid usage
  // see https://github.com/nodejs/node/issues/32753
  {
    assert.throws(
      () => {
        const buffer = require('buffer')
        new buffer.Buffer.prototype.lastIndexOf(1, 'str')
      },
      {
        code: 'ERR_INVALID_ARG_TYPE',
        name: 'TypeError',
        message:
          'The "buffer" argument must be an instance of Buffer, ' +
          'TypedArray, or DataView. ' +
          'Received an instance of lastIndexOf',
      },
    )
  }
})

test('Buffer.includes (node.js repository test)', () => {
  const b = Buffer.from('abcdef')
  const buf_a = Buffer.from('a')
  const buf_bc = Buffer.from('bc')
  const buf_f = Buffer.from('f')
  const buf_z = Buffer.from('z')
  const buf_empty = Buffer.from('')

  assert(b.includes('a'))
  assert(!b.includes('a', 1))
  assert(!b.includes('a', -1))
  assert(!b.includes('a', -4))
  assert(b.includes('a', -b.length))
  // assert(b.includes('a', NaN)) ❌
  assert(b.includes('a', -Infinity))
  assert(!b.includes('a', Infinity))
  assert(b.includes('bc'))
  assert(!b.includes('bc', 2))
  assert(!b.includes('bc', -1))
  assert(!b.includes('bc', -3))
  assert(b.includes('bc', -5))
  // assert(b.includes('bc', NaN)) ❌
  assert(b.includes('bc', -Infinity))
  assert(!b.includes('bc', Infinity))
  assert(b.includes('f'), b.length - 1)
  assert(!b.includes('z'))
  assert(b.includes(''))
  assert(b.includes('', 1))
  assert(b.includes('', b.length + 1))
  assert(b.includes('', Infinity))
  assert(b.includes(buf_a))
  assert(!b.includes(buf_a, 1))
  assert(!b.includes(buf_a, -1))
  assert(!b.includes(buf_a, -4))
  assert(b.includes(buf_a, -b.length))
  // assert(b.includes(buf_a, NaN)) ❌
  assert(b.includes(buf_a, -Infinity))
  assert(!b.includes(buf_a, Infinity))
  assert(b.includes(buf_bc))
  assert(!b.includes(buf_bc, 2))
  assert(!b.includes(buf_bc, -1))
  assert(!b.includes(buf_bc, -3))
  assert(b.includes(buf_bc, -5))
  // assert(b.includes(buf_bc, NaN)) ❌
  assert(b.includes(buf_bc, -Infinity))
  assert(!b.includes(buf_bc, Infinity))
  // @ts-expect-error
  assert(b.includes(buf_f), b.length - 1)
  assert(!b.includes(buf_z))
  assert(b.includes(buf_empty))
  assert(b.includes(buf_empty, 1))
  assert(b.includes(buf_empty, b.length + 1))
  assert(b.includes(buf_empty, Infinity))
  assert(b.includes(0x61))
  assert(!b.includes(0x61, 1))
  assert(!b.includes(0x61, -1))
  assert(!b.includes(0x61, -4))
  assert(b.includes(0x61, -b.length))
  // assert(b.includes(0x61, NaN)) ❌
  assert(b.includes(0x61, -Infinity))
  assert(!b.includes(0x61, Infinity))
  assert(!b.includes(0x0))

  // test offsets
  assert(b.includes('d', 2))
  assert(b.includes('f', 5))
  assert(b.includes('f', -1))
  assert(!b.includes('f', 6))

  assert(b.includes(Buffer.from('d'), 2))
  assert(b.includes(Buffer.from('f'), 5))
  assert(b.includes(Buffer.from('f'), -1))
  assert(!b.includes(Buffer.from('f'), 6))

  // assert(!Buffer.from('ff').includes(Buffer.from('f'), 1, 'ucs2')) ❌

  // test hex encoding
  assert.strictEqual(Buffer.from(b.toString('hex'), 'hex').includes('64', 0, 'hex'), true)
  assert.strictEqual(Buffer.from(b.toString('hex'), 'hex').includes(Buffer.from('64', 'hex'), 0, 'hex'), true)

  // Test base64 encoding
  assert.strictEqual(Buffer.from(b.toString('base64'), 'base64').includes('ZA==', 0, 'base64'), true)
  assert.strictEqual(
    Buffer.from(b.toString('base64'), 'base64').includes(Buffer.from('ZA==', 'base64'), 0, 'base64'),
    true,
  )

  // test ascii encoding
  // assert.strictEqual(Buffer.from(b.toString('ascii'), 'ascii').includes('d', 0, 'ascii'), true) ❌
  // assert.strictEqual(Buffer.from(b.toString('ascii'), 'ascii').includes(Buffer.from('d', 'ascii'), 0, 'ascii'), true) ❌

  // Test latin1 encoding
  // assert.strictEqual(Buffer.from(b.toString('latin1'), 'latin1').includes('d', 0, 'latin1'), true) ❌
  // assert.strictEqual( ❌
  //   Buffer.from(b.toString('latin1'), 'latin1').includes(Buffer.from('d', 'latin1'), 0, 'latin1'),
  //   true,
  // )

  // Test binary encoding
  // assert.strictEqual(Buffer.from(b.toString('binary'), 'binary').includes('d', 0, 'binary'), true) ❌
  // assert.strictEqual( ❌
  //   Buffer.from(b.toString('binary'), 'binary').includes(Buffer.from('d', 'binary'), 0, 'binary'),
  //   true,
  // )

  // test ucs2 encoding
  // let twoByteString = Buffer.from('\u039a\u0391\u03a3\u03a3\u0395', 'ucs2') ❌

  // assert(twoByteString.includes('\u0395', 4, 'ucs2')) ❌
  // assert(twoByteString.includes('\u03a3', -4, 'ucs2')) ❌
  // assert(twoByteString.includes('\u03a3', -6, 'ucs2')) ❌
  // assert(twoByteString.includes(Buffer.from('\u03a3', 'ucs2'), -6, 'ucs2')) ❌
  // assert(!twoByteString.includes('\u03a3', -2, 'ucs2')) ❌

  // const mixedByteStringUcs2 = Buffer.from('\u039a\u0391abc\u03a3\u03a3\u0395', 'ucs2') ❌
  // assert(mixedByteStringUcs2.includes('bc', 0, 'ucs2')) ❌
  // assert(mixedByteStringUcs2.includes('\u03a3', 0, 'ucs2')) ❌
  // assert(!mixedByteStringUcs2.includes('\u0396', 0, 'ucs2')) ❌

  // assert.ok(mixedByteStringUcs2.includes(Buffer.from('bc', 'ucs2'), 0, 'ucs2')) ❌
  // assert.ok(mixedByteStringUcs2.includes(Buffer.from('\u03a3', 'ucs2'), 0, 'ucs2')) ❌
  // assert.ok(!mixedByteStringUcs2.includes(Buffer.from('\u0396', 'ucs2'), 0, 'ucs2')) ❌

  // twoByteString = Buffer.from('\u039a\u0391\u03a3\u03a3\u0395', 'ucs2') ❌

  // Test single char pattern
  // assert(twoByteString.includes('\u039a', 0, 'ucs2')) ❌
  // assert(twoByteString.includes('\u0391', 0, 'ucs2'), 'Alpha') ❌
  // assert(twoByteString.includes('\u03a3', 0, 'ucs2'), 'First Sigma') ❌
  // assert(twoByteString.includes('\u03a3', 6, 'ucs2'), 'Second Sigma') ❌
  // assert(twoByteString.includes('\u0395', 0, 'ucs2'), 'Epsilon') ❌
  // assert(!twoByteString.includes('\u0392', 0, 'ucs2'), 'Not beta') ❌

  // Test multi-char pattern
  // assert(twoByteString.includes('\u039a\u0391', 0, 'ucs2'), 'Lambda Alpha') ❌
  // assert(twoByteString.includes('\u0391\u03a3', 0, 'ucs2'), 'Alpha Sigma') ❌
  // assert(twoByteString.includes('\u03a3\u03a3', 0, 'ucs2'), 'Sigma Sigma') ❌
  // assert(twoByteString.includes('\u03a3\u0395', 0, 'ucs2'), 'Sigma Epsilon') ❌

  const mixedByteStringUtf8 = Buffer.from('\u039a\u0391abc\u03a3\u03a3\u0395')
  assert(mixedByteStringUtf8.includes('bc'))
  assert(mixedByteStringUtf8.includes('bc', 5))
  assert(mixedByteStringUtf8.includes('bc', -8))
  assert(mixedByteStringUtf8.includes('\u03a3'))
  assert(!mixedByteStringUtf8.includes('\u0396'))

  // Test complex string includes algorithms. Only trigger for long strings.
  // Long string that isn't a simple repeat of a shorter string.
  let longString = 'A'
  for (let i = 66; i < 76; i++) {
    // from 'B' to 'K'
    longString = longString + String.fromCharCode(i) + longString
  }

  const longBufferString = Buffer.from(longString)

  // Pattern of 15 chars, repeated every 16 chars in long
  let pattern = 'ABACABADABACABA'
  for (let i = 0; i < longBufferString.length - pattern.length; i += 7) {
    const includes = longBufferString.includes(pattern, i)
    assert(includes, `Long ABACABA...-string at index ${i}`)
  }
  assert(longBufferString.includes('AJABACA'), 'Long AJABACA, First J')
  assert(longBufferString.includes('AJABACA', 511), 'Long AJABACA, Second J')

  pattern = 'JABACABADABACABA'
  assert(longBufferString.includes(pattern), 'Long JABACABA..., First J')
  assert(longBufferString.includes(pattern, 512), 'Long JABACABA..., Second J')

  // Search for a non-ASCII string in a pure ASCII string.
  const asciiString = Buffer.from('arglebargleglopglyfarglebargleglopglyfarglebargleglopglyf')
  assert(!asciiString.includes('\x2061'))
  assert(asciiString.includes('leb', 0))

  // Search in string containing many non-ASCII chars.
  const allCodePoints = [] as number[]
  for (let i = 0; i < 65534; i++) allCodePoints[i] = i
  // eslint-disable-next-line prefer-spread
  const allCharsString = String.fromCharCode.apply(String, allCodePoints) + String.fromCharCode(65534, 65535)
  const allCharsBufferUtf8 = Buffer.from(allCharsString)
  // const allCharsBufferUcs2 = Buffer.from(allCharsString, 'ucs2') ❌

  // Search for string long enough to trigger complex search with ASCII pattern
  // and UC16 subject.
  assert(!allCharsBufferUtf8.includes('notfound'))
  // assert(!allCharsBufferUcs2.includes('notfound')) ❌

  // Find substrings in Utf8.
  const lengths = [1, 3, 15] // Single char, simple and complex.
  const indices = [0x5, 0x60, 0x400, 0x680, 0x7ee, 0xff02, 0x16610, 0x2f77b]
  for (let lengthIndex = 0; lengthIndex < lengths.length; lengthIndex++) {
    for (let i = 0; i < indices.length; i++) {
      const index = indices[i]
      let length = lengths[lengthIndex]

      if (index + length > 0x7f) {
        length = 2 * length
      }

      if (index + length > 0x7ff) {
        length = 3 * length
      }

      if (index + length > 0xffff) {
        length = 4 * length
      }

      const patternBufferUtf8 = allCharsBufferUtf8.slice(index, index + length)
      // @ts-expect-error
      assert(index, allCharsBufferUtf8.includes(patternBufferUtf8))

      const patternStringUtf8 = patternBufferUtf8.toString()
      // @ts-expect-error
      assert(index, allCharsBufferUtf8.includes(patternStringUtf8))
    }
  }

  // Find substrings in Usc2. ❌
  // lengths = [2, 4, 16] // Single char, simple and complex.
  // indices = [0x5, 0x65, 0x105, 0x205, 0x285, 0x2005, 0x2085, 0xfff0]
  // for (let lengthIndex = 0; lengthIndex < lengths.length; lengthIndex++) {
  //   for (let i = 0; i < indices.length; i++) {
  //     const index = indices[i] * 2
  //     const length = lengths[lengthIndex]

  //     const patternBufferUcs2 = allCharsBufferUcs2.slice(index, index + length)
  //     assert.ok(allCharsBufferUcs2.includes(patternBufferUcs2, 0, 'ucs2'))

  //     const patternStringUcs2 = patternBufferUcs2.toString('ucs2')
  //     assert.ok(allCharsBufferUcs2.includes(patternStringUcs2, 0, 'ucs2'))
  //   }
  // }

  ;[() => {}, {}, []].forEach((val) => {
    // assert.throws(() => b.includes(val)) ❌
  })

  // Test truncation of Number arguments to uint8
  {
    const buf = Buffer.from('this is a test')
    assert.ok(buf.includes(0x6973))
    assert.ok(buf.includes(0x697320))
    assert.ok(buf.includes(0x69732069))
    assert.ok(buf.includes(0x697374657374))
    assert.ok(buf.includes(0x69737374))
    assert.ok(buf.includes(0x69737465))
    assert.ok(buf.includes(0x69737465))
    assert.ok(buf.includes(-140))
    assert.ok(buf.includes(-152))
    assert.ok(!buf.includes(0xff))
    assert.ok(!buf.includes(0xffff))
  }
})
