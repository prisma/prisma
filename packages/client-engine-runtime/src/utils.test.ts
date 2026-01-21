import { safeJsonStringify } from './utils'

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
    const result = JSON.parse(safeJsonStringify(obj)) as {
      user: { id: string; files: Array<{ fileId: string }> }
    }
    expect(result.user.id).toBe('312590077454712834')
    expect(result.user.files[0].fileId).toBe('412590077454712834')
  })
})
