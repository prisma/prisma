import { isCi } from '../isCi'

const originalEnv = { ...process.env }
const originalStdinisTTY = process.stdin.isTTY

describe('isCi', () => {
  beforeEach(async () => {
    process.env = originalEnv
    process.stdin.isTTY = originalStdinisTTY
  })
  afterAll(() => {
    process.env = originalEnv
    process.stdin.isTTY = originalStdinisTTY
  })

  describe('in non TTY environment', () => {
    process.stdin.isTTY = false

    test('isCi should be false', () => {
      expect(isCi()).toBe(false)
    })
  })

  describe('in TTY environment', () => {
    process.stdin.isTTY = true

    test('with CI env var, isCi should be true', () => {
      process.env.CI = '1'
      expect(isCi()).toBe(true)
    })

    test('with GitHub Actions env var, isCi should be true', () => {
      process.env.GITHUB_ACTIONS = 'true'
      expect(isCi()).toBe(true)
    })

    test('outside a CI environment, should return false', () => {
      process.env.CI = undefined
      process.env.GITHUB_ACTIONS = undefined
      expect(isCi()).toBe(false)
    })
  })
})
