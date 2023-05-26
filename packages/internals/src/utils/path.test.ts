import { pathToPosix } from './path'

const testIf = (condition: boolean) => (condition ? test : test.skip)

describe('pathToPosix', () => {
  test('forward slashes', () => {
    expect(pathToPosix('a/b/c')).toBe('a/b/c')
  })

  testIf(process.platform === 'win32')('backslashes on windows', () => {
    expect(pathToPosix('a\\b\\c')).toBe('a/b/c')
  })

  testIf(process.platform !== 'win32')('backslashes on posix', () => {
    expect(pathToPosix('a\\b\\c')).toBe('a\\b\\c')
  })
})
