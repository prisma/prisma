import * as lzString from 'lz-string'

export const decompressFromBase64 = (str: string) => {
  if (TARGET_ENGINE_TYPE === 'data-proxy' || TARGET_ENGINE_TYPE === 'all') {
    return lzString.decompressFromBase64(str)
  }
  return str
}
