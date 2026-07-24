/**
 * Minimal EWKB (Extended Well-Known Binary) reader for the PostGIS codec.
 *
 * `node-postgres` returns geometry columns as hex-encoded EWKB strings by
 * default. This reader parses the subset we ship with the extension —
 * Point, LineString, Polygon, and the Multi* counterparts — into GeoJSON
 * objects. Z and M coordinates are not supported; if a wire value carries
 * them, decoding throws so the caller can detect the mismatch instead of
 * silently dropping data.
 */

import { postgisError } from './errors';
import type {
  Geometry,
  GeometryLineString,
  GeometryMultiLineString,
  GeometryMultiPoint,
  GeometryMultiPolygon,
  GeometryPoint,
  GeometryPolygon,
  Position,
} from './geojson';

const FLAG_Z = 0x80000000;
const FLAG_M = 0x40000000;
const FLAG_SRID = 0x20000000;
const TYPE_MASK = 0x1fffffff;

const TYPE_POINT = 1;
const TYPE_LINESTRING = 2;
const TYPE_POLYGON = 3;
const TYPE_MULTIPOINT = 4;
const TYPE_MULTILINESTRING = 5;
const TYPE_MULTIPOLYGON = 6;

const HEX_PAIR_RE = /^[0-9a-fA-F]{2}$/;

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw postgisError('RUNTIME.DECODE_FAILED', 'Geometry wire value: odd-length hex string', {
      meta: { wirePreview: hex.slice(0, 32) },
    });
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const pair = hex.slice(i * 2, i * 2 + 2);
    if (!HEX_PAIR_RE.test(pair)) {
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        `Geometry wire value: invalid hex byte at offset ${i * 2}`,
        { meta: { wirePreview: hex.slice(0, 32) } },
      );
    }
    bytes[i] = Number.parseInt(pair, 16);
  }
  return bytes;
}

class Reader {
  private offset = 0;
  private readonly view: DataView;

  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private requireBytes(needed: number): void {
    if (this.offset + needed > this.view.byteLength) {
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        `Geometry wire value: unexpected end of buffer (need ${needed} bytes at offset ${this.offset}, ${this.view.byteLength - this.offset} available)`,
      );
    }
  }

  readUint8(): number {
    this.requireBytes(1);
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }

  readUint32(littleEndian: boolean): number {
    this.requireBytes(4);
    const v = this.view.getUint32(this.offset, littleEndian);
    this.offset += 4;
    return v >>> 0;
  }

  readFloat64(littleEndian: boolean): number {
    this.requireBytes(8);
    const v = this.view.getFloat64(this.offset, littleEndian);
    this.offset += 8;
    return v;
  }

  hasRemaining(): boolean {
    return this.offset !== this.view.byteLength;
  }

  remainingBytes(): number {
    return this.view.byteLength - this.offset;
  }
}

class Writer {
  private readonly bytes: number[] = [];

  writeUint8(value: number): void {
    this.bytes.push(value);
  }

  writeUint32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setUint32(0, value, true);
    this.bytes.push(...new Uint8Array(buffer));
  }

  writeFloat64(value: number): void {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    this.bytes.push(...new Uint8Array(buffer));
  }

  toHex(): string {
    return this.bytes
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
}

type Header = {
  readonly geomType: number;
  readonly littleEndian: boolean;
  readonly srid?: number;
};

function readHeader(reader: Reader): Header {
  const byteOrder = reader.readUint8();
  if (byteOrder !== 0 && byteOrder !== 1) {
    throw postgisError(
      'RUNTIME.DECODE_FAILED',
      `Geometry wire value: invalid byte order ${byteOrder}`,
    );
  }
  const littleEndian = byteOrder === 1;
  const typeCode = reader.readUint32(littleEndian);
  if ((typeCode & FLAG_Z) !== 0 || (typeCode & FLAG_M) !== 0) {
    throw postgisError(
      'RUNTIME.DECODE_FAILED',
      'Geometry wire value: Z/M coordinates are not supported',
    );
  }
  const geomType = typeCode & TYPE_MASK;
  if ((typeCode & FLAG_SRID) !== 0) {
    return { geomType, littleEndian, srid: reader.readUint32(littleEndian) };
  }
  return { geomType, littleEndian };
}

function readPosition(reader: Reader, littleEndian: boolean): Position {
  const x = reader.readFloat64(littleEndian);
  const y = reader.readFloat64(littleEndian);
  return [x, y];
}

function readPoint(reader: Reader, header: Header): GeometryPoint {
  const coords = readPosition(reader, header.littleEndian);
  return header.srid !== undefined
    ? { type: 'Point', coordinates: coords, srid: header.srid }
    : { type: 'Point', coordinates: coords };
}

function readLineString(reader: Reader, header: Header): GeometryLineString {
  const n = reader.readUint32(header.littleEndian);
  const coords: Position[] = [];
  for (let i = 0; i < n; i++) coords.push(readPosition(reader, header.littleEndian));
  return header.srid !== undefined
    ? { type: 'LineString', coordinates: coords, srid: header.srid }
    : { type: 'LineString', coordinates: coords };
}

function readPolygon(reader: Reader, header: Header): GeometryPolygon {
  const numRings = reader.readUint32(header.littleEndian);
  const rings: Position[][] = [];
  for (let r = 0; r < numRings; r++) {
    const n = reader.readUint32(header.littleEndian);
    const ring: Position[] = [];
    for (let i = 0; i < n; i++) ring.push(readPosition(reader, header.littleEndian));
    rings.push(ring);
  }
  return header.srid !== undefined
    ? { type: 'Polygon', coordinates: rings, srid: header.srid }
    : { type: 'Polygon', coordinates: rings };
}

function readSubGeometry(reader: Reader): Geometry {
  // Multi* geometries embed sub-WKB records; each carries its own header.
  const header = readHeader(reader);
  switch (header.geomType) {
    case TYPE_POINT:
      return readPoint(reader, header);
    case TYPE_LINESTRING:
      return readLineString(reader, header);
    case TYPE_POLYGON:
      return readPolygon(reader, header);
    default:
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        `Geometry wire value: unsupported sub-type ${header.geomType}`,
      );
  }
}

function readMultiPoint(reader: Reader, header: Header): GeometryMultiPoint {
  const n = reader.readUint32(header.littleEndian);
  const coords: Position[] = [];
  for (let i = 0; i < n; i++) {
    const sub = readSubGeometry(reader);
    if (sub.type !== 'Point') {
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        'Geometry wire value: MultiPoint contains non-Point sub-geometry',
      );
    }
    coords.push(sub.coordinates);
  }
  return header.srid !== undefined
    ? { type: 'MultiPoint', coordinates: coords, srid: header.srid }
    : { type: 'MultiPoint', coordinates: coords };
}

function readMultiLineString(reader: Reader, header: Header): GeometryMultiLineString {
  const n = reader.readUint32(header.littleEndian);
  const lines: ReadonlyArray<Position>[] = [];
  for (let i = 0; i < n; i++) {
    const sub = readSubGeometry(reader);
    if (sub.type !== 'LineString') {
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        'Geometry wire value: MultiLineString contains non-LineString sub-geometry',
      );
    }
    lines.push(sub.coordinates);
  }
  return header.srid !== undefined
    ? { type: 'MultiLineString', coordinates: lines, srid: header.srid }
    : { type: 'MultiLineString', coordinates: lines };
}

function readMultiPolygon(reader: Reader, header: Header): GeometryMultiPolygon {
  const n = reader.readUint32(header.littleEndian);
  const polys: ReadonlyArray<ReadonlyArray<Position>>[] = [];
  for (let i = 0; i < n; i++) {
    const sub = readSubGeometry(reader);
    if (sub.type !== 'Polygon') {
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        'Geometry wire value: MultiPolygon contains non-Polygon sub-geometry',
      );
    }
    polys.push(sub.coordinates);
  }
  return header.srid !== undefined
    ? { type: 'MultiPolygon', coordinates: polys, srid: header.srid }
    : { type: 'MultiPolygon', coordinates: polys };
}

export function decodeEWKBHex(hex: string): Geometry {
  const reader = new Reader(hexToBytes(hex));
  const header = readHeader(reader);
  const geometry = readGeometryBody(reader, header);
  if (reader.hasRemaining()) {
    throw postgisError(
      'RUNTIME.DECODE_FAILED',
      `Geometry wire value: trailing data after geometry (${reader.remainingBytes()} bytes)`,
      { meta: { wirePreview: hex.slice(0, 32) } },
    );
  }
  return geometry;
}

export function encodeEWKBHex(value: Geometry): string {
  const writer = new Writer();
  writeGeometry(writer, value);
  return writer.toHex();
}

function writeHeader(writer: Writer, geomType: number, srid?: number): void {
  writer.writeUint8(1);
  writer.writeUint32(srid === undefined ? geomType : geomType | FLAG_SRID);
  if (srid !== undefined) {
    writer.writeUint32(srid);
  }
}

function writePosition(writer: Writer, position: Position): void {
  if (!Number.isFinite(position[0]) || !Number.isFinite(position[1])) {
    throw postgisError(
      'RUNTIME.ENCODE_FAILED',
      'Geometry encode: coordinates must be finite numbers',
    );
  }
  writer.writeFloat64(position[0]);
  writer.writeFloat64(position[1]);
}

function writeLineStringBody(writer: Writer, positions: ReadonlyArray<Position>): void {
  writer.writeUint32(positions.length);
  for (const position of positions) {
    writePosition(writer, position);
  }
}

function writePolygonBody(writer: Writer, rings: ReadonlyArray<ReadonlyArray<Position>>): void {
  writer.writeUint32(rings.length);
  for (const ring of rings) {
    writeLineStringBody(writer, ring);
  }
}

function writeGeometry(writer: Writer, value: Geometry): void {
  switch (value.type) {
    case 'Point':
      writeHeader(writer, TYPE_POINT, value.srid);
      writePosition(writer, value.coordinates);
      break;
    case 'LineString':
      writeHeader(writer, TYPE_LINESTRING, value.srid);
      writeLineStringBody(writer, value.coordinates);
      break;
    case 'Polygon':
      writeHeader(writer, TYPE_POLYGON, value.srid);
      writePolygonBody(writer, value.coordinates);
      break;
    case 'MultiPoint':
      writeHeader(writer, TYPE_MULTIPOINT, value.srid);
      writer.writeUint32(value.coordinates.length);
      for (const position of value.coordinates) {
        writeHeader(writer, TYPE_POINT);
        writePosition(writer, position);
      }
      break;
    case 'MultiLineString':
      writeHeader(writer, TYPE_MULTILINESTRING, value.srid);
      writer.writeUint32(value.coordinates.length);
      for (const line of value.coordinates) {
        writeHeader(writer, TYPE_LINESTRING);
        writeLineStringBody(writer, line);
      }
      break;
    case 'MultiPolygon':
      writeHeader(writer, TYPE_MULTIPOLYGON, value.srid);
      writer.writeUint32(value.coordinates.length);
      for (const polygon of value.coordinates) {
        writeHeader(writer, TYPE_POLYGON);
        writePolygonBody(writer, polygon);
      }
      break;
  }
}

function readGeometryBody(reader: Reader, header: Header): Geometry {
  switch (header.geomType) {
    case TYPE_POINT:
      return readPoint(reader, header);
    case TYPE_LINESTRING:
      return readLineString(reader, header);
    case TYPE_POLYGON:
      return readPolygon(reader, header);
    case TYPE_MULTIPOINT:
      return readMultiPoint(reader, header);
    case TYPE_MULTILINESTRING:
      return readMultiLineString(reader, header);
    case TYPE_MULTIPOLYGON:
      return readMultiPolygon(reader, header);
    default:
      throw postgisError(
        'RUNTIME.DECODE_FAILED',
        `Geometry wire value: unsupported geometry type ${header.geomType}`,
      );
  }
}

/**
 * Encode a GeoJSON-shaped geometry to an EWKT string PostGIS understands
 * via `'<ewkt>'::geometry`. We use EWKT (not EWKB) on the way in so the
 * generated SQL stays human-readable.
 */
export function encodeEWKT(value: Geometry): string {
  const sridPrefix = value.srid !== undefined ? `SRID=${value.srid};` : '';
  switch (value.type) {
    case 'Point':
      return `${sridPrefix}POINT(${formatPosition(value.coordinates)})`;
    case 'LineString':
      return `${sridPrefix}LINESTRING(${value.coordinates.map(formatPosition).join(',')})`;
    case 'Polygon':
      return `${sridPrefix}POLYGON(${formatRings(value.coordinates)})`;
    case 'MultiPoint':
      return `${sridPrefix}MULTIPOINT(${value.coordinates.map(formatPosition).join(',')})`;
    case 'MultiLineString':
      return `${sridPrefix}MULTILINESTRING(${value.coordinates
        .map((line) => `(${line.map(formatPosition).join(',')})`)
        .join(',')})`;
    case 'MultiPolygon':
      return `${sridPrefix}MULTIPOLYGON(${value.coordinates
        .map((poly) => `(${formatRings(poly)})`)
        .join(',')})`;
  }
}

function formatPosition(p: Position): string {
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
    throw postgisError(
      'RUNTIME.ENCODE_FAILED',
      'Geometry encode: coordinates must be finite numbers',
    );
  }
  return `${p[0]} ${p[1]}`;
}

function formatRings(rings: ReadonlyArray<ReadonlyArray<Position>>): string {
  return rings.map((ring) => `(${ring.map(formatPosition).join(',')})`).join(',');
}
