import { ConnectionInfo, Flavour } from '@prisma/driver-adapter-utils'

import { EngineConfig } from '../../common/Engine'

export type QueryCompiler = {
  compile(request: string): Promise<string>
}

export type QueryCompilerOptions = {
  datamodel: string
  flavour: Flavour
  connectionInfo: ConnectionInfo
}

export interface QueryCompilerConstructor {
  new (options: QueryCompilerOptions): QueryCompiler
}

export interface QueryCompilerLoader {
  loadQueryCompiler(config: EngineConfig): Promise<QueryCompilerConstructor>
}
