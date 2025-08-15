import sql from 'mssql'
import { describe, expect, test } from 'vitest'

import { mapRow } from './conversion'

describe('conversion', () => {
  test.each([1.1, 1.3534578, 13413.466])('returns the number %d prior to truncation - no f32 precision loss', (num) => {
    const truncated = new Float32Array([num])[0]
    expect(num).not.toEqual(truncated)
    expect(mapRow([truncated], [{ type: sql.Real, name: '', nullable: false, primary: false }])).toEqual([num])
  })

  test.each([13413.465845, 234236.243572347, 0.345783258435])('returns the number %d - f32 precision loss', (num) => {
    const truncated = new Float32Array([num])[0]
    expect(num).not.toEqual(truncated)
    expect(mapRow([num], [{ type: sql.Real, name: '', nullable: false, primary: false }])).toEqual([num])
  })
})
