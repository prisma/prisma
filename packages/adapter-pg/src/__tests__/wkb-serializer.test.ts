import { describe, expect, test } from 'vitest'

import { parseWKB } from '../wkb-parser'
import { serializeWKB } from '../wkb-serializer'

describe('WKB Serializer', () => {
  describe('Point', () => {
    test('round-trip Point without SRID', () => {
      const point = { type: 'Point' as const, coordinates: [1.5, 2.5] as [number, number] }
      const wkb = serializeWKB(point)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(point)
    })

    test('round-trip Point with SRID 4326', () => {
      const point = { type: 'Point' as const, coordinates: [1, 2] as [number, number], srid: 4326 }
      const wkb = serializeWKB(point)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(point)
    })

    test('round-trip Point with SRID 3857', () => {
      const point = { type: 'Point' as const, coordinates: [-122.4194, 37.7749] as [number, number], srid: 3857 }
      const wkb = serializeWKB(point)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(point)
    })

    test('round-trip Point with negative coordinates', () => {
      const point = { type: 'Point' as const, coordinates: [-1.5, -2.5] as [number, number] }
      const wkb = serializeWKB(point)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(point)
    })
  })

  describe('LineString', () => {
    test('round-trip LineString without SRID', () => {
      const lineString = {
        type: 'LineString' as const,
        coordinates: [[1, 2] as [number, number], [3, 4] as [number, number]],
      }
      const wkb = serializeWKB(lineString)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(lineString)
    })

    test('round-trip LineString with SRID', () => {
      const lineString = {
        type: 'LineString' as const,
        coordinates: [[0, 0] as [number, number], [1, 1] as [number, number], [2, 2] as [number, number]],
        srid: 4326,
      }
      const wkb = serializeWKB(lineString)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(lineString)
    })

    test('round-trip LineString with many points', () => {
      const coordinates: [number, number][] = []
      for (let i = 0; i < 100; i++) {
        coordinates.push([i, i * 2])
      }
      const lineString = { type: 'LineString' as const, coordinates }
      const wkb = serializeWKB(lineString)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(lineString)
    })
  })

  describe('Polygon', () => {
    test('round-trip Polygon without holes', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0] as [number, number],
            [1, 0] as [number, number],
            [1, 1] as [number, number],
            [0, 0] as [number, number],
          ],
        ],
      }
      const wkb = serializeWKB(polygon)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(polygon)
    })

    test('round-trip Polygon with hole and SRID', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0] as [number, number],
            [5, 0] as [number, number],
            [5, 5] as [number, number],
            [0, 5] as [number, number],
            [0, 0] as [number, number],
          ],
          [
            [1, 1] as [number, number],
            [2, 1] as [number, number],
            [2, 2] as [number, number],
            [1, 1] as [number, number],
          ],
        ],
        srid: 4326,
      }
      const wkb = serializeWKB(polygon)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(polygon)
    })

    test('round-trip Polygon with multiple holes', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0] as [number, number],
            [10, 0] as [number, number],
            [10, 10] as [number, number],
            [0, 10] as [number, number],
            [0, 0] as [number, number],
          ],
          [
            [1, 1] as [number, number],
            [2, 1] as [number, number],
            [2, 2] as [number, number],
            [1, 1] as [number, number],
          ],
          [
            [7, 7] as [number, number],
            [8, 7] as [number, number],
            [8, 8] as [number, number],
            [7, 7] as [number, number],
          ],
        ],
      }
      const wkb = serializeWKB(polygon)
      const parsed = parseWKB(wkb)
      expect(parsed).toEqual(polygon)
    })
  })

  describe('Buffer size', () => {
    test('Point buffer size is correct', () => {
      const point = { type: 'Point' as const, coordinates: [1, 2] as [number, number] }
      const wkb = serializeWKB(point)
      expect(wkb.length).toBe(1 + 4 + 16)
    })

    test('Point with SRID buffer size is correct', () => {
      const point = { type: 'Point' as const, coordinates: [1, 2] as [number, number], srid: 4326 }
      const wkb = serializeWKB(point)
      expect(wkb.length).toBe(1 + 4 + 4 + 16)
    })

    test('LineString buffer size is correct', () => {
      const lineString = {
        type: 'LineString' as const,
        coordinates: [[1, 2] as [number, number], [3, 4] as [number, number]],
      }
      const wkb = serializeWKB(lineString)
      expect(wkb.length).toBe(1 + 4 + 4 + 2 * 16)
    })

    test('Polygon buffer size is correct', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [0, 0] as [number, number],
            [1, 0] as [number, number],
            [1, 1] as [number, number],
            [0, 0] as [number, number],
          ],
        ],
      }
      const wkb = serializeWKB(polygon)
      expect(wkb.length).toBe(1 + 4 + 4 + 4 + 4 * 16)
    })
  })
})
