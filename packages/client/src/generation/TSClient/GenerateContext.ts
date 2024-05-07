import { GeneratorConfig } from '@prisma/generator-helper'

import { DMMFHelper } from '../dmmf'
import { GenericArgsInfo } from '../GenericsArgsInfo'
import { DefaultArgsAliases } from './DefaultArgsAliases'

export interface GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  defaultArgsAliases: DefaultArgsAliases
  generator?: GeneratorConfig
}

export class GenerateContext implements GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  defaultArgsAliases: DefaultArgsAliases
  generator?: GeneratorConfig

  constructor({ dmmf, genericArgsInfo, defaultArgsAliases, generator }: GenerateContextOptions) {
    this.dmmf = dmmf
    this.genericArgsInfo = genericArgsInfo
    this.defaultArgsAliases = defaultArgsAliases
    this.generator = generator
  }

  isPreviewFeatureOn(previewFeature: string): boolean {
    return this.generator?.previewFeatures?.includes(previewFeature) ?? false
  }
}
