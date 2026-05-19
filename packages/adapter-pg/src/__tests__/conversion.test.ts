import { describe, expect, it } from 'vitest'

import { mapArg } from '../conversion'

describe('mapArg', () => {
  it('converts a date with a 4-digit year (value >= 1000-01-01) to the correct date', () => {
    const date = new Date('1999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('1999-12-31')
  })

  it('converts a date with a 3-digit year (0100-01-01 <= value < 1000-01-01) to the correct date', () => {
    const date = new Date('0999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0999-12-31')
  })

  it('converts a date with a 2-digit year (0000-01-01 <= value < 0100-01-01) to the correct date', () => {
    const date = new Date('0099-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATE', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0099-12-31')
  })

  it('converts a date with a 4-digit year (value >= 1000-01-01) to the correct datetime', () => {
    const date = new Date('1999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('1999-12-31 23:59:59.999')
  })

  it('converts a date with a 3-digit year (0100-01-01 <= value < 1000-01-01) to the correct datetime', () => {
    const date = new Date('0999-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0999-12-31 23:59:59.999')
  })

  it('converts a date with a 2-digit year (0000-01-01 <= value < 0100-01-01) to the correct datetime', () => {
    const date = new Date('0099-12-31T23:59:59.999Z')
    const result = mapArg(date, { dbType: 'DATETIME', scalarType: 'datetime', arity: 'scalar' })
    expect(result).toBe('0099-12-31 23:59:59.999')
  })

  it('converts UTF-8 GeoJSON bytes (geometry-as-bytes placeholder) to WKB', () => {
    const json = JSON.stringify({ type: 'Point', coordinates: [13.4, 52.5], srid: 4326 })
    const utf8 = new TextEncoder().encode(json)
    const result = mapArg(utf8, { scalarType: 'bytes', arity: 'scalar' })
    expect(result).toBeInstanceOf(Uint8Array)
    const wkb = result as Uint8Array
    expect(wkb[0] === 0 || wkb[0] === 1).toBe(true)
    expect(wkb.length).toBeGreaterThan(5)
  })

  it('converts UTF-8 GeoJSON as byte number[] (Wasm JSON) to WKB', () => {
    const json = JSON.stringify({ type: 'Point', coordinates: [13.4, 52.5], srid: 4326 })
    const utf8 = new TextEncoder().encode(json)
    const bytes = Array.from(utf8)
    const result = mapArg(bytes, { scalarType: 'bytes', arity: 'scalar' })
    expect(result).toBeInstanceOf(Uint8Array)
    const wkb = result as Uint8Array
    expect(wkb[0] === 0 || wkb[0] === 1).toBe(true)
  })

  it('converts base64-encoded UTF-8 GeoJSON (bytes placeholder) to WKB', () => {
    const json = JSON.stringify({ type: 'Point', coordinates: [13.4, 52.5], srid: 4326 })
    const b64 = Buffer.from(json, 'utf8').toString('base64')
    const result = mapArg(b64, { scalarType: 'bytes', arity: 'scalar' })
    expect(result).toBeInstanceOf(Uint8Array)
    const wkb = result as Uint8Array
    expect(wkb[0] === 0 || wkb[0] === 1).toBe(true)
  })
})
