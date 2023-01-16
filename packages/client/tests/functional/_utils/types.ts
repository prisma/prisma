import { Providers } from './providers'

export type MatrixOptions = {
  optOut?: {
    from: `${Providers}`[]
    reason: string
  }
  skipDb?: boolean
  skipDefaultClientInstance?: boolean
  skipDataProxy?: {
    runtimes: ClientRuntime[]
    reason: string
  }
  // SQL Migraiton to apply after inital generated migration
  alterStatementCallback?: AlterStatementCallback

  // SQL Migraiton to apply before inital generated migration
  migrateStatementCallback?: AlterStatementCallback
}

export type NewPrismaClient<T extends new (...args: any) => any> = (
  ...args: ConstructorParameters<T>
) => InstanceType<T>

export type ClientRuntime = 'node' | 'edge'

export type ClientMeta = {
  dataProxy: boolean
  runtime: 'node' | 'edge'
}

export type AlterStatementCallback = (provider: Providers) => string

export type MigrateStatementCallback = (provider: Providers) => string
