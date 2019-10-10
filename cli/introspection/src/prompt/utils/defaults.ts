import { DatabaseType } from 'prisma-datamodel'
import { DatabaseCredentials } from '../../types'
import { GeneratorConfig } from '@prisma/generator-helper'

export const sqliteDefault: DatabaseCredentials = {
  type: DatabaseType.sqlite,
  uri: 'file:dev.db',
}

export const photonDefaultConfig: GeneratorConfig = {
  name: 'photon',
  provider: 'photonjs',
  config: {},
  output: null,
  binaryTargets: [],
}
