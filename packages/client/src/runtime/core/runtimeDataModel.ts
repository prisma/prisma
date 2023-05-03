import type { DMMF } from '@prisma/generator-helper'

import { lazyProperty } from '../../generation/lazyProperty'
import { BaseDMMF } from '../dmmf-types'

export type RuntimeModel = Omit<DMMF.Model, 'name'>
export type RuntimeEnum = Omit<DMMF.DatamodelEnum, 'name'>

export type RuntimeDataModel = {
  readonly models: Record<string, RuntimeModel>
  readonly enums: Record<string, RuntimeEnum>
  readonly types: Record<string, RuntimeModel>
}

export function dmmfToRuntimeDataModel(dmmfDataModel: DMMF.Datamodel): RuntimeDataModel {
  return {
    models: buildMapForRuntime(dmmfDataModel.models),
    enums: buildMapForRuntime(dmmfDataModel.enums),
    types: buildMapForRuntime(dmmfDataModel.types),
  }
}

function buildMapForRuntime<T extends { name: string }>(list: T[]): Record<string, Omit<T, 'name'>> {
  const result: Record<string, Omit<T, 'name'>> = {}
  for (const { name, ...rest } of list) {
    result[name] = rest
  }
  return result
}

export function defineDmmfProperty(target: object, runtimeDataModel: RuntimeDataModel) {
  const dmmfLazy = lazyProperty(() => runtimeDataModelToBaseDmmf(runtimeDataModel))

  Object.defineProperty(target, 'dmmf', {
    get: () => dmmfLazy.get(),
  })
}

function runtimeDataModelToBaseDmmf(runtimeDataModel: RuntimeDataModel): BaseDMMF {
  return {
    datamodel: {
      models: buildDMMFList(runtimeDataModel.models),
      enums: buildDMMFList(runtimeDataModel.enums),
      types: buildDMMFList(runtimeDataModel.types),
    },
  }
}

function buildDMMFList<T>(map: Record<string, T>): Array<T & { name: string }> {
  return Object.entries(map).map(([name, props]) => ({ name, ...props }))
}
