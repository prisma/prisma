import { GeneratorConfig } from '@prisma/generator'

import { DMMFHelper } from '../dmmf'
import { GenericArgsInfo } from '../GenericsArgsInfo'

export interface GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  generator?: GeneratorConfig
  runtimeJsPath: string
}

export class GenerateContext implements GenerateContextOptions {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  generator?: GeneratorConfig
  runtimeJsPath: string

  constructor({ dmmf, genericArgsInfo, generator, runtimeJsPath }: GenerateContextOptions) {
    this.dmmf = dmmf
    this.genericArgsInfo = genericArgsInfo
    this.generator = generator
    this.runtimeJsPath = runtimeJsPath
  }

  isPreviewFeatureOn(previewFeature: string): boolean {
    return this.generator?.previewFeatures?.includes(previewFeature) ?? false
  }

  get nestedRuntimeJsPath(): string {
    if (!this.runtimeJsPath.startsWith('.')) {
      return this.runtimeJsPath // absolute path
    }

    if (this.runtimeJsPath.startsWith('./')) {
      return `.${this.runtimeJsPath}` // replace ./ with ../
    }

    return `../${this.runtimeJsPath}`
  }
}
