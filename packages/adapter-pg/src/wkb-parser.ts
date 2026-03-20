import type { Geometry, LineString, Point, Polygon } from '@prisma/driver-adapter-utils'

import { WKBParseError } from './errors'
import { WKBReader } from './wkb-primitives'

function parsePoint(reader: WKBReader, srid?: number): Point {
  const coordinates = reader.readCoordinate()
  return { type: 'Point', coordinates, srid }
}

function parseLineString(reader: WKBReader, srid?: number): LineString {
  const numPoints = reader.readUint32()
  const coordinates = reader.readCoordinates(numPoints)
  return { type: 'LineString', coordinates, srid }
}

function parsePolygon(reader: WKBReader, srid?: number): Polygon {
  const numRings = reader.readUint32()
  const coordinates = reader.readRings(numRings)
  return { type: 'Polygon', coordinates, srid }
}

/**
 * Parses Well-Known Binary (WKB) buffer into a Geometry object.
 * Supports both WKB and EWKB (Extended WKB with SRID) formats.
 *
 * @param buffer - WKB/EWKB binary data
 * @returns Parsed geometry object
 * @throws {WKBParseError} If buffer format is invalid or geometry type unsupported
 * @throws {BufferError} If buffer is too small or corrupted
 */
export function parseWKB(buffer: Uint8Array): Geometry {
  const reader = new WKBReader(buffer)

  const wkbType = reader.readUint32()

  const hasSRID = (wkbType & 0x20000000) !== 0
  const geometryType = wkbType & 0xff

  let srid: number | undefined
  if (hasSRID) {
    srid = reader.readInt32()
  }

  switch (geometryType) {
    case 1:
      return parsePoint(reader, srid)
    case 2:
      return parseLineString(reader, srid)
    case 3:
      return parsePolygon(reader, srid)
    default:
      throw new WKBParseError(`Unsupported WKB geometry type: ${geometryType}`, geometryType, reader.offset)
  }
}
