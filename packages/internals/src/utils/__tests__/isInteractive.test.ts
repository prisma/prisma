import { isInteractive } from '../isInteractive'

const originalEnv = { ...process.env }

describe('isInteractive', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  describe('in non TTY environment', () => {
    const mockedValue = { isTTY: false } as NodeJS.ReadStream
    test('isInteractive should be false', () => {
      expect(isInteractive({ stream: mockedValue })).toBe(false)
    })

    test('isInteractive should be false if TERM = dumb', () => {
      process.env.TERM = 'dumb'
      expect(isInteractive({ stream: mockedValue })).toBe(false)
    })
  })

  describe('in TTY environment', () => {
    const mockedValue = { isTTY: true } as NodeJS.ReadStream
    test('isInteractive should be true', () => {
      expect(isInteractive({ stream: mockedValue })).toBe(true)
    })

    test('isInteractive should be false if TERM = dumb', () => {
      process.env.TERM = 'dumb'
      expect(isInteractive({ stream: mockedValue })).toBe(false)
    })
  })
})
