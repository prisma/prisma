import { EngineConfig } from '../../common/Engine'

export type QueryCompiler = {
  compile(request: string): Promise<string>
}

export type QueryCompilerOptions = {
  datamodel: string
  flavour: 'mysql' | 'postgres' | 'sqlite'
  connectionInfo: {
    schemaName?: string
    maxBindValues?: number
  }
}

export interface QueryCompilerConstructor {
  new (options: QueryCompilerOptions): QueryCompiler
}

export interface QueryCompilerLoader {
  loadQueryCompiler(config: EngineConfig): Promise<QueryCompilerConstructor>
}
