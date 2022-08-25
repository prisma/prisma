import fs from 'fs'
import { isInteractive } from '../isInteractive'

const originalEnv = { ...process.env }

describe('isInteractive', () => {
  beforeEach(async () => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  describe('in non TTY environment', () => {
    const mockedValue = { isTTY: false }
    test('isInteractive should be false', () => {
      // @ts-ignore
      expect(isInteractive({ stream: mockedValue })).toBe(false)
    })

    test('isInteractive should be false if TERM = dumb', () => {
      process.env.TERM = 'dumb'
      // @ts-ignore
      expect(isInteractive({ stream: mockedValue })).toBe(false)
    })
  })

  describe('in TTY environment', () => {
    const mockedValue = { isTTY: true }
    test('isInteractive should be true', () => {
      // @ts-ignore
      expect(isInteractive({ stream: mockedValue })).toBe(true)
    })

    test('isInteractive should be false if TERM = dumb', () => {
      process.env.TERM = 'dumb'
      // @ts-ignore
      expect(isInteractive({ stream: mockedValue })).toBe(false)
    })
  })
})
