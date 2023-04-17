import { DMMF } from '@prisma/generator-helper'
import lzString from 'lz-string'

import { escapeJson } from '../TSClient/helpers'

/**
 * Creates the necessary declarations to embed the generated DMMF into the
 * generated client. It compresses the DMMF for the data proxy engine. For
 * data proxy, the full DMMF is exported, otherwise `schema` is removed.
 * @param compressed
 * @param dmmf
 * @returns
 */
export function buildDMMF(compressed: boolean, dmmf: DMMF.Document) {
  if (compressed === true) {
    const dmmfString = escapeJson(JSON.stringify(dmmf))
    return buildCompressedDMMF(dmmfString)
  }

  const { datamodel, mappings } = dmmf
  const dmmfString = escapeJson(JSON.stringify({ datamodel, mappings }))
  return buildUncompressedDMMF(dmmfString)
}

/**
 * Build declarations for compressed DMMF exports
 * @param dmmf
 * @returns
 */
function buildCompressedDMMF(dmmf: string) {
  const compressedDMMF = lzString.compressToBase64(dmmf)

  return `
const compressedDMMF = '${compressedDMMF}'
const decompressedDMMF = decompressFromBase64(compressedDMMF)
// We are parsing 2 times, as we want independent objects, because
// DMMFClass introduces circular references in the dmmf object
const dmmf = parseDmmf(decompressedDMMF)
exports.Prisma.dmmf = parseDmmf(decompressedDMMF)`
}

/**
 * Build declaration for regular DMMF exports
 * @param dmmf
 * @returns
 */
function buildUncompressedDMMF(dmmf: string) {
  return `
const dmmfString = ${JSON.stringify(dmmf)}
const dmmf = JSON.parse(dmmfString)
exports.Prisma.dmmf = JSON.parse(dmmfString)`
}
