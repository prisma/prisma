import { hasCiVariable } from '../hasCiVariable'

const originalEnv = { ...process.env }
const originalStdinisTTY = process.stdin.isTTY

describe('hasCiVariable', () => {
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

    test('with undefined env vars, hasCiVariable should be false', () => {
      expect(hasCiVariable()).toBe(false)
    })
  })

  describe('in TTY environment', () => {
    beforeEach(() => {
      delete process.env.BUILDKITE
      delete process.env.GITHUB_ACTIONS
      delete process.env.CI
      process.stdin.isTTY = true
    })

    test('with CI env var, hasCiVariable should return CI variable', () => {
      process.env.CI = 'true'
      expect(hasCiVariable()).toEqual('CI')
    })

    test('with GitHub Actions env var, hasCiVariable should return CI variable', () => {
      process.env.GITHUB_ACTIONS = 'true'
      expect(hasCiVariable()).toBe('GITHUB_ACTIONS')
    })

    test('with undefined env vars, hasCiVariable should be false', () => {
      expect(hasCiVariable()).toBe(false)
    })
  })
})
