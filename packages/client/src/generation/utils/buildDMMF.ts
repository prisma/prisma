import lzString from 'lz-string'

/**
 * Creates the necessary declarations to embed the generated DMMF into the
 * generated client. It compresses the DMMF for the data proxy engine.
 * @param engineType
 * @param dmmf
 * @returns
 */
export function buildDMMF(dataProxy: boolean, dmmf: string) {
  if (dataProxy === true) {
    return buildCompressedDMMF(dmmf)
  }

  return buildUncompressedDMMF(dmmf)
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
const dmmf = JSON.parse(decompressedDMMF)
exports.Prisma.dmmf = JSON.parse(decompressedDMMF)`
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
