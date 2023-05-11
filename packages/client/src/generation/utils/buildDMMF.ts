import { DMMF } from '@prisma/generator-helper'
import { getQueryEngineProtocol } from '@prisma/internals'
import lzString from 'lz-string'

import { dmmfToRuntimeDataModel } from '../../runtime/core/runtimeDataModel'
import { escapeJson } from '../TSClient/helpers'
import { TSClientOptions } from '../TSClient/TSClient'

export function buildDMMF({ document, dataProxy, generator }: TSClientOptions) {
  const engineProtocol = getQueryEngineProtocol(generator)
  const needsFullDMMF = dataProxy && engineProtocol === 'graphql'

  if (needsFullDMMF === true) {
    return buildFullDMMF(document)
  }

  return buildRuntimeDataModel(document.datamodel)
}

/**
 * Embeds compressed snapshot of full DMMF document into generated client.
 * Creates `runtimeDataModel` from full document dynamically, after decompressing
 * and parsing the document.
 *
 * @param dmmf
 * @returns
 */
function buildFullDMMF(dmmf: DMMF.Document) {
  const dmmfString = escapeJson(JSON.stringify(dmmf))
  const compressedDMMF = lzString.compressToBase64(dmmfString)

  return `
const compressedDMMF = '${compressedDMMF}'
const decompressedDMMF = decompressFromBase64(compressedDMMF)
// We are parsing 2 times, as we want independent objects, because
// DMMFClass introduces circular references in the dmmf object
const dmmf = JSON.parse(decompressedDMMF)
Prisma.dmmf = JSON.parse(decompressedDMMF)
config.document = dmmf`
}

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
function buildRuntimeDataModel(datamodel: DMMF.Datamodel) {
  const runtimeDataModel = dmmfToRuntimeDataModel(datamodel)
  const datamodelString = escapeJson(JSON.stringify(runtimeDataModel))
  return `
config.runtimeDataModel = JSON.parse(${JSON.stringify(datamodelString)})
defineDmmfProperty(Prisma, config.runtimeDataModel)`
}
