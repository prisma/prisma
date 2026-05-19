import type { Geometry, LineString, Point, Polygon } from '@prisma/driver-adapter-utils'

import { InvalidGeometryError } from './errors'
import { WKBWriter } from './wkb-primitives'

function extractGeometryType(geometry: Geometry): string {
  return (geometry as { type: string }).type
}

function getWKBType(geometry: Geometry): number {
  switch (geometry.type) {
    case 'Point':
      return 1
    case 'LineString':
      return 2
    case 'Polygon':
      return 3
    default:
      throw new InvalidGeometryError(`Unsupported geometry type: ${extractGeometryType(geometry)}`, geometry)
  }
}

function coordByteLength(coord: Point['coordinates']): number {
  return coord.length * 8
}

function calculateGeometrySize(geometry: Geometry): number {
  switch (geometry.type) {
    case 'Point':
      return coordByteLength(geometry.coordinates)
    case 'LineString':
      return 4 + geometry.coordinates.reduce((sum, coord) => sum + coordByteLength(coord), 0)
    case 'Polygon':
      return (
        4 + geometry.coordinates.reduce((sum, ring) => sum + 4 + ring.reduce((s, c) => s + coordByteLength(c), 0), 0)
      )
    default:
      throw new InvalidGeometryError(`Unsupported geometry type: ${extractGeometryType(geometry)}`, geometry)
  }
}

function writePoint(writer: WKBWriter, point: Point): void {
  writer.writeCoordinate(point.coordinates)
}

function writeLineString(writer: WKBWriter, lineString: LineString): void {
  writer.writeUint32(lineString.coordinates.length)
  writer.writeCoordinates(lineString.coordinates)
}

function writePolygon(writer: WKBWriter, polygon: Polygon): void {
  writer.writeUint32(polygon.coordinates.length)
  writer.writeRings(polygon.coordinates)
}

/**
 * Serializes a Geometry object to Well-Known Binary (WKB) format.
 * Uses little-endian byte order with EWKB extensions for SRID.
 *
 * @param geometry - Geometry object to serialize
 * @returns WKB/EWKB binary buffer
 * @throws {InvalidGeometryError} If geometry structure is invalid or type unsupported
 * @throws {BufferError} If buffer operations fail
 */
export function serializeWKB(geometry: Geometry): Uint8Array {
  const srid = geometry.srid ?? 0
  const hasSRID = srid !== 0

  let size = 1 + 4
  if (hasSRID) size += 4
  size += calculateGeometrySize(geometry)

  const writer = new WKBWriter(size)

  const wkbType = getWKBType(geometry) | (hasSRID ? 0x20000000 : 0)
  writer.writeUint32(wkbType)

  if (hasSRID) {
    writer.writeInt32(srid)
  }

  switch (geometry.type) {
    case 'Point':
      writePoint(writer, geometry)
      break
    case 'LineString':
      writeLineString(writer, geometry)
      break
    case 'Polygon':
      writePolygon(writer, geometry)
      break
  }

  return writer.getBuffer()
}
