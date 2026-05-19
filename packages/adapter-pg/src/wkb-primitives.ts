import { BufferError, WKBParseError } from './errors'

/**
 * Low-level WKB reading primitives.
 * Operates directly on DataView for zero-copy performance.
 *
 * WKB Format (Well-Known Binary):
 * - Byte 0: Byte order (1 = little-endian, 0 = big-endian)
 * - Bytes 1-4: WKB type code
 * - Bytes 5-8: SRID (optional, EWKB extension)
 * - Remaining: Geometry data
 */
export class WKBReader {
  readonly #view: DataView
  #offset: number
  readonly #littleEndian: boolean

  constructor(buffer: Uint8Array) {
    if (buffer.length < 5) {
      throw new BufferError('WKB buffer too small', 5, buffer.length)
    }

    this.#view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    this.#offset = 0

    const byteOrder = this.#view.getUint8(0)
    this.#littleEndian = byteOrder === 1
    this.#offset = 1
  }

  get offset(): number {
    return this.#offset
  }

  get littleEndian(): boolean {
    return this.#littleEndian
  }

  /**
   * Read unsigned 32-bit integer.
   */
  readUint32(): number {
    if (this.#offset + 4 > this.#view.byteLength) {
      throw new BufferError('Cannot read uint32: buffer overflow', this.#offset + 4, this.#view.byteLength)
    }

    const value = this.#view.getUint32(this.#offset, this.#littleEndian)
    this.#offset += 4
    return value
  }

  /**
   * Read signed 32-bit integer (used for SRID).
   */
  readInt32(): number {
    if (this.#offset + 4 > this.#view.byteLength) {
      throw new BufferError('Cannot read int32: buffer overflow', this.#offset + 4, this.#view.byteLength)
    }

    const value = this.#view.getInt32(this.#offset, this.#littleEndian)
    this.#offset += 4
    return value
  }

  /**
   * Read 64-bit double-precision float (coordinates).
   */
  readDouble(): number {
    if (this.#offset + 8 > this.#view.byteLength) {
      throw new BufferError('Cannot read double: buffer overflow', this.#offset + 8, this.#view.byteLength)
    }

    const value = this.#view.getFloat64(this.#offset, this.#littleEndian)
    this.#offset += 8
    return value
  }

  /**
   * Read a single coordinate pair [x, y].
   */
  readCoordinate(): [number, number] {
    const x = this.readDouble()
    const y = this.readDouble()
    return [x, y]
  }

  /**
   * Read multiple coordinate pairs.
   */
  readCoordinates(count: number): [number, number][] {
    if (count < 0) {
      throw new WKBParseError(`Invalid coordinate count: ${count}`, 0, this.#offset)
    }

    const coords: [number, number][] = []
    for (let i = 0; i < count; i++) {
      coords.push(this.readCoordinate())
    }
    return coords
  }

  /**
   * Read polygon rings (array of coordinate arrays).
   * Each ring starts with a uint32 point count.
   */
  readRings(ringCount: number): [number, number][][] {
    if (ringCount < 0) {
      throw new WKBParseError(`Invalid ring count: ${ringCount}`, 0, this.#offset)
    }

    const rings: [number, number][][] = []
    for (let i = 0; i < ringCount; i++) {
      const pointCount = this.readUint32()
      rings.push(this.readCoordinates(pointCount))
    }
    return rings
  }
}

/**
 * Low-level WKB writing primitives.
 * Builds WKB buffer with little-endian byte order.
 */
export class WKBWriter {
  readonly #buffer: Uint8Array
  readonly #view: DataView
  #offset: number

  constructor(size: number) {
    if (size < 5) {
      throw new BufferError('WKB buffer size too small', 5, size)
    }

    this.#buffer = new Uint8Array(size)
    this.#view = new DataView(this.#buffer.buffer)
    this.#offset = 0

    this.#view.setUint8(0, 1)
    this.#offset = 1
  }

  get offset(): number {
    return this.#offset
  }

  /**
   * Write unsigned 32-bit integer.
   */
  writeUint32(value: number): void {
    if (this.#offset + 4 > this.#buffer.length) {
      throw new BufferError('Cannot write uint32: buffer overflow', this.#offset + 4, this.#buffer.length)
    }

    this.#view.setUint32(this.#offset, value, true)
    this.#offset += 4
  }

  /**
   * Write signed 32-bit integer (used for SRID).
   */
  writeInt32(value: number): void {
    if (this.#offset + 4 > this.#buffer.length) {
      throw new BufferError('Cannot write int32: buffer overflow', this.#offset + 4, this.#buffer.length)
    }

    this.#view.setInt32(this.#offset, value, true)
    this.#offset += 4
  }

  /**
   * Write 64-bit double-precision float (coordinates).
   */
  writeDouble(value: number): void {
    if (this.#offset + 8 > this.#buffer.length) {
      throw new BufferError('Cannot write double: buffer overflow', this.#offset + 8, this.#buffer.length)
    }

    this.#view.setFloat64(this.#offset, value, true)
    this.#offset += 8
  }

  /**
   * Write a single coordinate [x, y] or [x, y, z].
   */
  writeCoordinate(coord: [number, number] | [number, number, number]): void {
    this.writeDouble(coord[0])
    this.writeDouble(coord[1])
    if (coord.length === 3) {
      this.writeDouble(coord[2])
    }
  }

  /**
   * Write multiple coordinates.
   */
  writeCoordinates(coords: Array<[number, number] | [number, number, number]>): void {
    for (const coord of coords) {
      this.writeCoordinate(coord)
    }
  }

  /**
   * Write polygon rings (array of coordinate arrays).
   * Each ring includes a uint32 point count prefix.
   */
  writeRings(rings: Array<Array<[number, number] | [number, number, number]>>): void {
    for (const ring of rings) {
      this.writeUint32(ring.length)
      this.writeCoordinates(ring)
    }
  }

  /**
   * Get the final buffer.
   */
  getBuffer(): Uint8Array {
    return this.#buffer
  }
}
