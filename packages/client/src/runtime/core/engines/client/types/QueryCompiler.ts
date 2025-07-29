import { QueryCompilerConstructor } from '@prisma/client-common'

import { EngineConfig } from '../../common/Engine'

export interface QueryCompilerLoader {
  loadQueryCompiler(config: EngineConfig): Promise<QueryCompilerConstructor>
}
