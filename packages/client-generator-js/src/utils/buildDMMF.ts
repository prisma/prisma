import {
  dmmfToRuntimeDataModel,
  PrunedRuntimeDataModel,
  pruneRuntimeDataModel,
  RuntimeDataModel,
} from '@prisma/client-common'
import { escapeJson } from '@prisma/client-generator-common/escapeJson'
import type * as DMMF from '@prisma/dmmf'

import { TSClientOptions } from '../TSClient/TSClient'

/**
 * Given DMMF models, computes runtime datamodel from it and embeds
 * it into generated client. Creates lazy `Prisma.dmmf` property for backward
 * compatibility, which will dynamically compute DMMF.Datamodel from runtime
 * datamodel when accessed.
 * Note: Prisma client itself never uses `Prisma.dmmf` and uses runtime datamodel
 * instead. We are preserving it only for backward compatibility with third party tools.
 * If we remove it in a future major version, we can further optimize the format — client
 * needs way less information that is present there at the moment
 *
 * @param datamodel
 * @returns
 */
export function buildRuntimeDataModel(datamodel: DMMF.Datamodel, runtimeNameJs: TSClientOptions['runtimeNameJs']) {
  const runtimeDataModel = dmmfToRuntimeDataModel(datamodel)

  let prunedDataModel: PrunedRuntimeDataModel | RuntimeDataModel
  if (runtimeNameJs === 'wasm-engine-edge' || runtimeNameJs === 'wasm-compiler-edge' || runtimeNameJs === 'client') {
    prunedDataModel = pruneRuntimeDataModel(runtimeDataModel)
  } else {
    prunedDataModel = runtimeDataModel
  }
  const datamodelString = escapeJson(JSON.stringify(prunedDataModel))

  return `
config.runtimeDataModel = JSON.parse(${JSON.stringify(datamodelString)})
defineDmmfProperty(exports.Prisma, config.runtimeDataModel)`
}
