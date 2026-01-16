import { safeJsonParse, safeJsonStringify } from './utils'

describe('safeJsonParse', () => {
  test('parses regular JSON normally', () => {
    expect(safeJsonParse('{"name":"Alice","age":30}')).toEqual({ name: 'Alice', age: 30 })
  })

  test('parses arrays', () => {
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3])
  })

  test('parses nested objects', () => {
    expect(safeJsonParse('{"user":{"id":123,"name":"Bob"}}')).toEqual({
      user: { id: 123, name: 'Bob' },
    })
  })

  test('handles top-level large integer JSON values', () => {
    // JSON can be a bare scalar value (e.g., JSON columns storing numeric scalars)
    expect(safeJsonParse('312590077454712834')).toBe('312590077454712834')
    expect(safeJsonParse('-312590077454712834')).toBe('-312590077454712834')
  })

  test('preserves 15-digit integers as numbers (safe)', () => {
    // 15-digit integers are always safe
    expect(safeJsonParse('{"id":123456789012345}')).toEqual({ id: 123456789012345 })
  })

  test('converts 16+ digit integers to strings (may exceed MAX_SAFE_INTEGER)', () => {
    // 16-digit integers may exceed MAX_SAFE_INTEGER, so convert to string
    // This includes MAX_SAFE_INTEGER (9007199254740991) which has 16 digits
    const result = safeJsonParse('{"id":9007199254740991}')
    expect(result).toEqual({ id: '9007199254740991' })
  })

  test('converts large integers (18 digits) to strings to preserve precision', () => {
    // 312590077454712834 is a typical BigInt ID that exceeds MAX_SAFE_INTEGER
    // Without safeJsonParse, JSON.parse would lose precision
    const result = safeJsonParse('{"userId":312590077454712834}')
    expect(result).toEqual({ userId: '312590077454712834' })
    // The string value preserves exact precision
    expect((result as { userId: string }).userId).toBe('312590077454712834')
  })

  test('handles multiple large integers in the same object', () => {
    const result = safeJsonParse('{"userId":312590077454712834,"fileId":912590077454712834}')
    expect(result).toEqual({
      userId: '312590077454712834',
      fileId: '912590077454712834',
    })
  })

  test('handles large integers in arrays', () => {
    const result = safeJsonParse('[312590077454712834,412590077454712834]')
    expect(result).toEqual(['312590077454712834', '412590077454712834'])
  })

  test('handles negative large integers', () => {
    const result = safeJsonParse('{"id":-312590077454712834}')
    expect(result).toEqual({ id: '-312590077454712834' })
  })

  test('handles large integers in nested structures', () => {
    const result = safeJsonParse('{"user":{"id":312590077454712834,"files":[{"fileId":412590077454712834}]}}')
    expect(result).toEqual({
      user: {
        id: '312590077454712834',
        files: [{ fileId: '412590077454712834' }],
      },
    })
  })

  test('handles mixed arrays with small and large integers', () => {
    const result = safeJsonParse('[1, 312590077454712834, 3]')
    expect(result).toEqual([1, '312590077454712834', 3])
  })

  test('preserves large integers inside string values unchanged', () => {
    // Large integers inside string literals should not be modified
    const json = '{"msg": "ID: 12345678901234567890, more text", "id": 9876543210987654321}'
    const result = safeJsonParse(json)
    expect(result).toEqual({
      msg: 'ID: 12345678901234567890, more text',
      id: '9876543210987654321',
    })
  })

  test('handles escaped quotes in strings with large integers', () => {
    const json = '{"msg": "Say \\"12345678901234567890\\" here", "val": 1234567890123456789}'
    const result = safeJsonParse(json)
    expect(result).toEqual({
      msg: 'Say "12345678901234567890" here',
      val: '1234567890123456789',
    })
  })

  test('demonstrates the precision loss problem it solves', () => {
    const originalId = '312590077454712834'
    const json = `{"userId":${originalId}}`

    // Standard JSON.parse would lose precision
    const unsafeParsed = JSON.parse(json)
    expect(unsafeParsed.userId).not.toBe(312590077454712834n) // Not BigInt, it's a Number
    // The exact corruption value varies by JS engine, just verify it's corrupted
    expect(unsafeParsed.userId.toString()).not.toBe('312590077454712834')

    // safeJsonParse preserves the value as string
    const safeParsed = safeJsonParse(json)
    expect((safeParsed as { userId: string }).userId).toBe('312590077454712834') // Exact value preserved
  })
})

describe('safeJsonStringify', () => {
  test('serializes BigInt values as strings', () => {
    const obj = { id: BigInt('312590077454712834') }
    expect(safeJsonStringify(obj)).toBe('{"id":"312590077454712834"}')
  })

  test('serializes Uint8Array as base64', () => {
    const obj = { data: new Uint8Array([1, 2, 3, 4]) }
    expect(safeJsonStringify(obj)).toBe('{"data":"AQIDBA=="}')
  })

  test('handles nested BigInt values', () => {
    const obj = {
      user: {
        id: BigInt('312590077454712834'),
        files: [{ fileId: BigInt('412590077454712834') }],
      },
    }
    const result = safeJsonParse(safeJsonStringify(obj))
    expect(result.user.id).toBe('312590077454712834')
    expect(result.user.files[0].fileId).toBe('412590077454712834')
  })
})
