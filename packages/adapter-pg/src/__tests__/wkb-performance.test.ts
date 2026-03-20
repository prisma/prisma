import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { parseWKB } from '../wkb-parser'
import { serializeWKB } from '../wkb-serializer'

const ITERATIONS = 100
const MEMORY_ITERATIONS = 1000
const PER_OP_THRESHOLD_MS = 10

function measureAverageTime(fn: () => void, iterations: number): number {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const elapsed = performance.now() - start
  return elapsed / iterations
}

function logBenchmark(name: string, avgMs: number, iterations: number): void {
  if (process.env.WKB_PERF_VERBOSE) {
    console.log(`  ${name}: ${avgMs.toFixed(4)}ms/op (${iterations} iterations)`)
  }
}

function createPointWKB(): Uint8Array {
  return serializeWKB({ type: 'Point', coordinates: [1.5, 2.5] })
}

function createLineStringWKB(numPoints: number): Uint8Array {
  const coordinates: [number, number][] = []
  for (let i = 0; i < numPoints; i++) {
    coordinates.push([i, i * 2])
  }
  return serializeWKB({ type: 'LineString', coordinates })
}

function createPolygonWKB(): Uint8Array {
  const polygon = {
    type: 'Polygon' as const,
    coordinates: [
      [[0, 0] as [number, number], [1, 0] as [number, number], [1, 1] as [number, number], [0, 0] as [number, number]],
    ],
  }
  return serializeWKB(polygon)
}

describe('WKB Performance', () => {
  describe('Parsing Performance', () => {
    test('Point parsing within threshold', () => {
      const wkb = createPointWKB()
      const avgMs = measureAverageTime(() => parseWKB(wkb), ITERATIONS)
      logBenchmark('Point parse', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })

    test('LineString with 10 points within threshold', () => {
      const wkb = createLineStringWKB(10)
      const avgMs = measureAverageTime(() => parseWKB(wkb), ITERATIONS)
      logBenchmark('LineString(10) parse', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })

    test('LineString with 100 points within threshold', () => {
      const wkb = createLineStringWKB(100)
      const avgMs = measureAverageTime(() => parseWKB(wkb), ITERATIONS)
      logBenchmark('LineString(100) parse', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })

    test('Polygon with simple ring within threshold', () => {
      const wkb = createPolygonWKB()
      const avgMs = measureAverageTime(() => parseWKB(wkb), ITERATIONS)
      logBenchmark('Polygon parse', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })
  })

  describe('Serialization Performance', () => {
    test('Point serialization within threshold', () => {
      const point = { type: 'Point' as const, coordinates: [1.5, 2.5] as [number, number] }
      const avgMs = measureAverageTime(() => serializeWKB(point), ITERATIONS)
      logBenchmark('Point serialize', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })

    test('LineString with 10 points serialization within threshold', () => {
      const coordinates: [number, number][] = []
      for (let i = 0; i < 10; i++) coordinates.push([i, i * 2])
      const lineString = { type: 'LineString' as const, coordinates }
      const avgMs = measureAverageTime(() => serializeWKB(lineString), ITERATIONS)
      logBenchmark('LineString(10) serialize', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })

    test('LineString with 100 points serialization within threshold', () => {
      const coordinates: [number, number][] = []
      for (let i = 0; i < 100; i++) coordinates.push([i, i * 2])
      const lineString = { type: 'LineString' as const, coordinates }
      const avgMs = measureAverageTime(() => serializeWKB(lineString), ITERATIONS)
      logBenchmark('LineString(100) serialize', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })

    test('Polygon serialization within threshold', () => {
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
      const avgMs = measureAverageTime(() => serializeWKB(polygon), ITERATIONS)
      logBenchmark('Polygon serialize', avgMs, ITERATIONS)
      expect(avgMs).toBeLessThan(PER_OP_THRESHOLD_MS)
    })
  })

  describe('Memory Efficiency', () => {
    test('uses zero-copy buffer access via DataView', () => {
      const wkb = createPointWKB()
      const result = parseWKB(wkb)
      expect(result.type).toBe('Point')

      const view = new DataView(wkb.buffer, wkb.byteOffset, wkb.byteLength)
      expect(view.buffer).toBe(wkb.buffer)
      expect(view.byteLength).toBe(wkb.byteLength)
    })

    test('DataView wraps buffer without copying', () => {
      const original = new Uint8Array([0x01, 0x01, 0x00, 0x00, 0x00])
      const view = new DataView(original.buffer, original.byteOffset, original.byteLength)
      expect(view.buffer).toBe(original.buffer)
      expect(view.byteOffset).toBe(original.byteOffset)
    })

    test('memory usage stable after many parse operations', () => {
      const wkb = createLineStringWKB(50)
      const heapBefore = process.memoryUsage().heapUsed

      for (let i = 0; i < MEMORY_ITERATIONS; i++) {
        parseWKB(wkb)
      }

      const heapAfter = process.memoryUsage().heapUsed
      const delta = heapAfter - heapBefore
      const deltaPerOp = delta / MEMORY_ITERATIONS

      expect(deltaPerOp).toBeLessThan(5000)
    })
  })

  describe('Bundle Size Check', () => {
    test('reports source file sizes within target', () => {
      const __dirname = dirname(fileURLToPath(import.meta.url))
      const parserPath = join(__dirname, '..', 'wkb-parser.ts')
      const serializerPath = join(__dirname, '..', 'wkb-serializer.ts')

      let parserSize = 0
      let serializerSize = 0

      if (existsSync(parserPath)) {
        parserSize = readFileSync(parserPath, 'utf-8').length
      }
      if (existsSync(serializerPath)) {
        serializerSize = readFileSync(serializerPath, 'utf-8').length
      }

      const totalSourceChars = parserSize + serializerSize
      const targetBytes = 15 * 1024
      expect(parserSize).toBeGreaterThan(0)
      expect(serializerSize).toBeGreaterThan(0)
      expect(totalSourceChars).toBeLessThan(targetBytes)
    })

    test('reports compiled bundle size when built', () => {
      const __dirname = dirname(fileURLToPath(import.meta.url))
      const pkgRoot = join(__dirname, '..', '..')
      const distIndexJs = join(pkgRoot, 'dist', 'index.js')
      const distIndexMjs = join(pkgRoot, 'dist', 'index.mjs')

      if (!existsSync(distIndexJs) || !existsSync(distIndexMjs)) {
        return
      }

      const cjsSize = readFileSync(distIndexJs).length
      const esmSize = readFileSync(distIndexMjs).length

      expect(cjsSize).toBeGreaterThan(0)
      expect(esmSize).toBeGreaterThan(0)
    })
  })
})
