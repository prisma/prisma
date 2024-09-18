/** https://github.com/planetscale/database-js/blob/v1.19.0/src/text.ts */

const decoder = new TextDecoder('utf-8')

export function decodeUtf8(text): string {
  return text ? decoder.decode(uint8Array(text)) : ''
}

export function uint8Array(text): Uint8Array {
  return Uint8Array.from(bytes(text))
}

function bytes(text): number[] {
  return text.split('').map((c) => c.charCodeAt(0))
}
