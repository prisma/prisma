import { ClientEngineType } from '@prisma/internals'

import { ProviderFlavors, Providers } from './providers'

export type MatrixOptions = {
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
  skipProviderFlavor?: {
    from: `${ProviderFlavors}`[]
    reason: string
  }
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

export type ClientRuntime = 'node' | 'edge' | 'wasm'

export type CliMeta = {
  dataProxy: boolean
  runtime: ClientRuntime
  previewFeatures: string[]
  engineType: ClientEngineType | undefined
}

export type ClientMeta = {
  driverAdapter: boolean
  dataProxy: boolean
  runtime: ClientRuntime
}

export type AlterStatementCallback = (provider: Providers) => string
