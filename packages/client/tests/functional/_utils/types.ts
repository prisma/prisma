import { ProviderFlavors, Providers } from './providers'

export type MatrixOptions = {
  optOut?: {
    from: `${Providers}`[]
    reason: string
  }
  skipBinary?: {
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

export type ClientRuntime = 'node' | 'edge'

export type TestCliMeta = {
  dataProxy: boolean
  runtime: 'node' | 'edge'
}

export type ClientMeta = {
  driverAdapter: boolean
  dataProxy: boolean
  runtime: 'node' | 'edge'
}

export type AlterStatementCallback = (provider: Providers) => string
