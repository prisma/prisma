import 'jest-extended'
import 'jest'

declare function testIf(condition: boolean): jest.It
declare function describeIf(condition: boolean): jest.Describe
declare function skipTestIf(condition: boolean): jest.It
declare function testRepeat(times: number): jest.It

declare module 'jest' {
  interface Matchers<R, T = {}> extends jest.Matchers<R, T> {
    toMatchPrismaErrorSnapshot(): R
    toMatchPrismaErrorInlineSnapshot(snapshot?: string): R
  }
}
