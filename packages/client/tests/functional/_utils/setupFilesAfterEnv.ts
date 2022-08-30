import { toMatchInlineSnapshot, toMatchSnapshot } from 'jest-snapshot'
import stripAnsi from 'strip-ansi'

process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS = 'true'

globalThis.testIf = (condition: boolean) => (condition ? test : test.skip)
globalThis.describeIf = (condition: boolean) => (condition ? describe : describe.skip)

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

export {}
