import { isCi } from '../isCi'

// This allows us to override the return value of `is-ci`. The getter method
// is required because the package exports a value, not a function, and we want
// to be able to control it in tests.
const mockValue = jest.fn().mockReturnValue(false)
jest.mock('is-ci', () => ({
  get isCi() {
    return mockValue()
  },
}))

const temporarilySet = (object: any, prop: string, value: unknown) => {
  const original = object[prop]
  beforeEach(() => {
    // If you set undefined in process.env it stringifies it, so we
    // need special handling for that case of "unsetting" the process.env.
    if (object === process.env && value === undefined) {
      delete object[prop]
    } else {
      object[prop] = value
    }
  })
  afterEach(() => {
    // If you set undefined in process.env it stringifies it, so we
    // need special handling for that case of "unsetting" the process.env.
    if (object === process.env && original === undefined) {
      delete object[prop]
    } else {
      object[prop] = original
    }
  })
}

describe('#isCi', () => {
  describe('when outside a TTY environment', () => {
    temporarilySet(process.stdin, 'isTTY', false)

    test('returns false', () => {
      expect(isCi()).toBe(true)
    })
  })

  describe('when in TTY environment', () => {
    temporarilySet(process.stdin, 'isTTY', true)

    test('when isCiLib tells us so', () => {
      mockValue.mockReturnValueOnce(true)
      expect(isCi()).toBe(true)
    })

    describe('with GitHub Actions env var', () => {
      temporarilySet(process.env, 'GITHUB_ACTIONS', 'true')

      test('returns true', () => {
        expect(isCi()).toBe(true)
      })
    })

    describe('outside a CI environment, with TTY', () => {
      temporarilySet(process.stdin, 'isTTY', true)
      temporarilySet(process.env, 'GITHUB_ACTIONS', undefined)

      test('returns false', () => {
        mockValue.mockReturnValueOnce(false)
        expect(isCi()).toBe(false)
      })
    })
  })
})
