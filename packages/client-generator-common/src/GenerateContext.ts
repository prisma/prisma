import { DMMFHelper } from './dmmf'
import { GenericArgsInfo } from './GenericsArgsInfo'
import { TypeBuilders } from './type-builders'

export interface GenerateContext {
  dmmf: DMMFHelper
  genericArgsInfo: GenericArgsInfo
  tsx: TypeBuilders
  isPreviewFeatureOn(previewFeature: string): boolean
}
