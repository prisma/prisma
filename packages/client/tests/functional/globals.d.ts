declare function testIf(condition: boolean): jest.It
declare function describeIf(condition: boolean): jest.Describe
declare function testRepeat(times: number): jest.It

declare namespace jest {
  interface Matchers<R, T = {}> {
    toMatchPrismaErrorSnapshot(): R
    toMatchPrismaErrorInlineSnapshot(snapshot?: string): R
  }
}
