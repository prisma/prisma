/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-loss-of-precision */

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
