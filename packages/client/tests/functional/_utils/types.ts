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
  alterStatement?: string
}

export type NewPrismaClient<T extends new (...args: any) => any> = (
  ...args: ConstructorParameters<T>
) => InstanceType<T>

export type ClientRuntime = 'node' | 'edge'

export type ClientMeta = {
  dataProxy: boolean
  runtime: 'node' | 'edge'
}
