import { GeneratorConfig } from '@prisma/generator-helper'

import { DMMFHelper } from '../dmmf'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { DefaultArgsAliases } from './DefaultArgsAliases'

export interface GenerateContext {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  defaultArgsAliases: DefaultArgsAliases
  generator?: GeneratorConfig
}
