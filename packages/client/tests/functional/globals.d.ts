declare function testIf(condition: boolean): jest.It
declare function describeIf(condition: boolean): jest.Describe
declare function $test(config: { runIf?: boolean; skipIf?: boolean; failIf?: boolean }): jest.It
declare function testRepeat(times: number): jest.It
declare function $beforeAll(config: { failIf? }): jest.Lifecycle
declare function $beforeEach(config: { failIf? }): jest.Lifecycle
declare function $afterAll(config: { failIf? }): jest.Lifecycle
declare function $afterEach(config: { failIf? }): jest.Lifecycle

declare namespace jest {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Matchers<R, T = {}> {
    toMatchPrismaErrorSnapshot(): R
    toMatchPrismaErrorInlineSnapshot(snapshot?: string): R
  }
}
