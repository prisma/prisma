declare function testIf(condition: boolean): jest.It
declare function describeIf(condition: boolean): jest.Describe
declare function $test(config: { runIf?: boolean; skipIf?: boolean; failIf?: boolean }): jest.It
declare function testRepeat(times: number): jest.It

declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R, T = {}> {
    toMatchPrismaErrorSnapshot(): R
    toMatchPrismaErrorInlineSnapshot(snapshot?: string): R
  }
}
