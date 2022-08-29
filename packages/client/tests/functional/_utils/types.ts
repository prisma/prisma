import { Providers } from './providers'

export type MatrixOptions = {
  optOut?: {
    from: `${Providers}`[]
    reason: string
  }
  skipDb?: boolean
  skipDefaultClientInstance?: boolean
  skipDataProxy?: boolean
}

export type NewPrismaClient<T extends new (...args: any) => any> = (
  ...args: ConstructorParameters<T>
) => InstanceType<T>

export type ClientRuntime = 'node' | 'edge'

export type ClientMeta = {
  dataProxy: boolean
  runtime: 'node' | 'edge'
}
