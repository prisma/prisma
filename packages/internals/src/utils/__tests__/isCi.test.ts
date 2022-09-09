import { isCi } from '../isCi'

const originalEnv = { ...process.env }
const originalStdinisTTY = process.stdin.isTTY

describe('isCi', () => {
  beforeEach(() => {
    process.env = originalEnv
    process.stdin.isTTY = originalStdinisTTY
  })
  afterAll(() => {
    process.env = originalEnv
    process.stdin.isTTY = originalStdinisTTY
  })

  describe('in non TTY environment', () => {
    beforeEach(() => {
      delete process.env.BUILDKITE
      delete process.env.GITHUB_ACTIONS
      delete process.env.CI
      process.stdin.isTTY = false
    })

    test('with undefined env vars, isCi should be false', () => {
      expect(isCi()).toBe(false)
    })
  })

  describe('in TTY environment', () => {
    beforeEach(() => {
      delete process.env.BUILDKITE
      delete process.env.GITHUB_ACTIONS
      delete process.env.CI
      process.stdin.isTTY = true
    })

    test('with CI env var, isCi should be true', () => {
      process.env.CI = 'true'
      expect(isCi()).toBe(true)
    })

    test('with GitHub Actions env var, isCi should be true', () => {
      process.env.GITHUB_ACTIONS = 'true'
      expect(isCi()).toBe(true)
    })

    test('with undefined env vars, isCi should be false', () => {
      expect(isCi()).toBe(false)
    })
  })
})
