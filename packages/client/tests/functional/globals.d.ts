import 'jest-extended'
import 'jest'

declare global {
  function testIf(condition: boolean): jest.It
  function describeIf(condition: boolean): jest.Describe
  function skipTestIf(condition: boolean): jest.It
  function testRepeat(times: number): jest.It
  namespace jest {
    interface Matchers<R> {
      toMatchPrismaErrorSnapshot(): R
      toMatchPrismaErrorInlineSnapshot(snapshot?: string): R
    }
  }
}
