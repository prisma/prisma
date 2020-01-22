import { DatabaseCredentials } from '@prisma/sdk'
import { GeneratorConfig } from '@prisma/generator-helper'

export const sqliteDefault: DatabaseCredentials = {
  type: 'sqlite',
  uri: 'file:dev.db',
}

export const photonDefaultConfig: GeneratorConfig = {
  name: 'client',
  provider: 'prisma-client-js',
  config: {},
  output: null,
  binaryTargets: [],
}
