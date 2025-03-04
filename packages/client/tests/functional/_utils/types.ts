import type { ClientEngineType } from '@prisma/internals'

import type { TestsFactoryFnParams } from './defineMatrix'
import type { TestSuiteMatrix } from './getTestSuiteInfo'
import type { AdapterProviders, Providers } from './providers'

export type MatrixOptions<MatrixT extends TestSuiteMatrix = []> = {
  optOut?: {
    from: `${Providers}`[]
    reason: string
  }
  skipEngine?: {
    from: `${ClientEngineType}`[]
    reason: string
  }
  skipDefaultClientInstance?: boolean
  skipDataProxy?: {
    runtimes: ClientRuntime[]
    reason: string
  }
  skipDriverAdapter?: {
    from: `${AdapterProviders}`[]
    reason: string
  }
  skip?: (
    when: (predicate: boolean | (() => boolean), reason: string) => void,
    suiteConfig: TestsFactoryFnParams<MatrixT>[0],
  ) => void
  skipDb?: boolean
  // SQL Migration to apply after initial generated migration
  alterStatementCallback?: AlterStatementCallback
}

export type NewPrismaClient<T extends new (...args: any) => any> = (
  ...args: ConstructorParameters<T>
) => InstanceType<T>

export type Db = {
  setupDb: () => Promise<void>
  dropDb: () => Promise<void>
}

export type ClientRuntime = 'node' | 'edge' | 'wasm' | 'client'

export type CliMeta = {
  dataProxy: boolean
  runtime: ClientRuntime
  previewFeatures: string[]
  engineType: `${ClientEngineType}` | undefined
}

export type ClientMeta = {
  driverAdapter: boolean
  dataProxy: boolean
  runtime: ClientRuntime
}

export type AlterStatementCallback = (provider: Providers) => string
