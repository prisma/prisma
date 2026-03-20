import { TestsFactoryFnParams } from './defineMatrix'
import { TestSuiteMatrix } from './getTestSuiteInfo'
import { AdapterProviders, GeneratorTypes, Providers } from './providers'

export type MatrixOptions<MatrixT extends TestSuiteMatrix = []> = {
  /**
   * When true, do not expand PostgreSQL suites into every driver-adapter flavor (e.g. js_pg, neon).
   * Use for suites that only make sense with a specific matrix `driverAdapter` (e.g. PostGIS + JS_PG_POSTGIS).
   */
  skipProviderFlavorExpansion?: boolean
  optOut?: {
    from: `${Providers}`[]
    reason: string
  }
  skipDefaultClientInstance?: boolean
  skipDriverAdapter?: {
    from: `${AdapterProviders}`[]
    reason: string
  }
  skip?: (
    when: (predicate: boolean | (() => boolean), reason: string) => void,
    suiteConfig: TestsFactoryFnParams<MatrixT>[0],
  ) => void
  skipDb?: boolean
  // SQL to run before DbPush (e.g. CREATE EXTENSION for PostGIS)
  beforeDbPushCallback?: (provider: Providers, databaseUrl: string) => Promise<void>
  /**
   * When `TEST_REUSE_DATABASE` is set, db push uses `--force-reset`. Runs immediately after that reset
   * and before the schema push (unlike `alterStatementCallback`, which runs after a successful push).
   */
  afterForceResetCallback?: (provider: Providers, databaseUrl: string) => Promise<void>
  // SQL Migration to apply after initial generated migration
  alterStatementCallback?: AlterStatementCallback
}

// Helper type to make adapter and accelerateUrl optional since they're provided by the test setup
// This allows callers to omit adapter/accelerateUrl since they're already provided by setupTestSuiteMatrix
type MakeAdapterAndAccelerateUrlOptional<T> = T extends [infer Options, ...infer Rest]
  ? Options extends object
    ? [Partial<Options>?, ...Rest]
    : T
  : T

export type NewPrismaClient<T, C extends new (...args: any) => any> = (
  ...args: MakeAdapterAndAccelerateUrlOptional<ConstructorParameters<C>>
) => T

export type Db = {
  setupDb: () => Promise<void>
  dropDb: () => Promise<void>
}

export type ClientRuntime = 'wasm-compiler-edge' | 'client'

export type ClientEngineExecutor = 'local' | 'remote'

export type CliMeta = {
  dataProxy: boolean
  runtime: ClientRuntime
  previewFeatures: string[]
  generatorType: `${GeneratorTypes}` | undefined
  clientEngineExecutor: ClientEngineExecutor
}

export type ClientMeta = {
  driverAdapter: boolean
  dataProxy: boolean
  runtime: ClientRuntime
  clientEngineExecutor: ClientEngineExecutor
}

export type AlterStatementCallback = (provider: Providers) => string
