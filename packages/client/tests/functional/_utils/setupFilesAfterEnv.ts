import { toMatchInlineSnapshot, toMatchSnapshot } from 'jest-snapshot'
import stripAnsi from 'strip-ansi'

process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS = 'true'

expect.extend({
  toMatchPrismaErrorSnapshot(received: unknown) {
    if (!(received instanceof Error)) {
      return {
        message: () => 'Expected instance of error',
        pass: false,
      }
    }
    // @ts-expect-error: jest-snapshot and jest typings are incompatible,
    // even though custom snapshot matchers supposed to work this way
    return toMatchSnapshot.call(this, sanitizeLineNumbers(received.message))
  },

  toMatchPrismaErrorInlineSnapshot(received: unknown, ...rest: unknown[]) {
    if (!(received instanceof Error)) {
      return {
        message: () => 'Expected instance of error',
        pass: false,
      }
    }

    // @ts-expect-error: jest-snapshot and jest typings are incompatible,
    // even though custom snapshot matchers supposed to work this way
    return toMatchInlineSnapshot.call(this, sanitizeLineNumbers(received.message), ...rest)
  },
})

function sanitizeLineNumbers(message: string) {
  return stripAnsi(message).replace(/^(\s*→?\s+)\d+/gm, '$1XX')
}

/**
 * Utility that busts test flakiness by running the same test multiple times.
 * This is especially useful for tests that fail locally but not on CI.
 * @param n Number of times to repeat the test
 * @returns
 */
function testRepeat(n: number) {
  const getRepeatProxy = (jestCall: jest.It) => {
    return new Proxy(jestCall, {
      // re-wrap the jest call to be repeated
      apply(target, thisArg, [name, cb, timeout]) {
        for (let i = 0; i < n; i++) {
          target(`${name} #${i}`, cb, timeout)
        }
      },
      // if not a call but eg. jest.concurrent
      get(target, prop) {
        return getRepeatProxy(target[prop])
      },
    })
  }

  return getRepeatProxy(test)
}

globalThis.testIf = (condition: boolean) => (condition ? test : test.skip)
globalThis.describeIf = (condition: boolean) => (condition ? describe : describe.skip)
globalThis.testRepeat = testRepeat

export {}
