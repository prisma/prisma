import { DMMFHelper } from '@prisma/client-generator-common/dmmf'
import { GenerateContext as BaseGenerateContext } from '@prisma/client-generator-common/GenerateContext'
import { GenericArgsInfo } from '@prisma/client-generator-common/GenericsArgsInfo'
import { TypeBuilders } from '@prisma/client-generator-common/type-builders'
import { GeneratorConfig } from '@prisma/generator'

export interface GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  generator?: GeneratorConfig
}

export class GenerateContext implements GenerateContextOptions, BaseGenerateContext {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  generator?: GeneratorConfig

  tsx = new TypeBuilders({
    Prisma: 'Prisma',
    Types: {
      self: '$Types',
      Extensions: '$Extensions',
      Result: '$Result',
      Utils: '$Utils',
    },
  })

  constructor({ dmmf, genericArgsInfo, generator }: GenerateContextOptions) {
    this.dmmf = dmmf
    this.genericArgsInfo = genericArgsInfo
    this.generator = generator
  }

  isPreviewFeatureOn(previewFeature: string): boolean {
    return this.generator?.previewFeatures?.includes(previewFeature) ?? false
  }
}
