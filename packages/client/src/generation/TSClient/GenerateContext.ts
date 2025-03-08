import type { GeneratorConfig } from '@prisma/generator-helper'

import type { DMMFHelper } from '../dmmf'
import type { GenericArgsInfo } from '../GenericsArgsInfo'

export interface GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  generator?: GeneratorConfig
}

export class GenerateContext implements GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  generator?: GeneratorConfig

  constructor({ dmmf, genericArgsInfo, generator }: GenerateContextOptions) {
    this.dmmf = dmmf
    this.genericArgsInfo = genericArgsInfo
    this.generator = generator
  }

  isPreviewFeatureOn(previewFeature: string): boolean {
    return this.generator?.previewFeatures?.includes(previewFeature) ?? false
  }
}
