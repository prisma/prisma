import type { ConnectionInfo, Provider } from '@prisma/driver-adapter-utils'

import type { EngineConfig } from '../../common/Engine'

export type QueryCompiler = {
  compile(request: string): Promise<string>
}

export type QueryCompilerOptions = {
  datamodel: string
  provider: Provider
  connectionInfo: ConnectionInfo
}

export interface QueryCompilerConstructor {
  new (options: QueryCompilerOptions): QueryCompiler
}

export interface QueryCompilerLoader {
  loadQueryCompiler(config: EngineConfig): Promise<QueryCompilerConstructor>
}
