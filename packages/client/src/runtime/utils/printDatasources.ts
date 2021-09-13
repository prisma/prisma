import type { Dictionary } from './common'

export type ConnectorType =
  | 'mysql'
  | 'mongodb'
  | 'sqlite'
  | 'postgresql'
  | 'sqlserver'
  | 'jdbc:sqlserver'

export interface GeneratorConfig {
  name: string
  output: string | null
  provider: string
  config: Dictionary<string>
}

export type Datasource =
  | string
  | {
      url: string
      [key: string]: any | undefined
    }

export interface InternalDatasource {
  name: string
  activeProvider: ConnectorType
  provider: ConnectorType
  url: EnvValue
  config: any
}

// We could do import { EnvValue } from '../../isdlToDatamodel2'
// but we don't want to pull that into the runtime build
export interface EnvValue {
  fromEnvVar: null | string
  value: string
}
