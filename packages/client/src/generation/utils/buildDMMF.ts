import { ClientEngineType } from '../../runtime/utils/getClientEngineType'

type Dictionary = { [k in string | number]: string | number }

/**
 * Creates the necessary declarations to embed the generated DMMF into the
 * generated client. It compresses the DMMF for the data proxy engine.
 * @param engineType
 * @param dmmf
 * @returns
 */
export function buildDMMF(engineType: ClientEngineType, dmmf: string) {
  if (engineType === ClientEngineType.DataProxy) {
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
  const dictionary = getJSONDictionary(dmmf)

  return `
const dmmfDictionary = ${JSON.stringify(reverseDictionary(dictionary))}
const compressedDMMF = '${translateJSONString(dmmf, dictionary)}'
const decompressedDMMF = translateJSONString(compressedDMMF, dmmfDictionary)
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

/**
 * Generate a dictionary from the tokens inside of a JSON string
 * @param json
 * @returns
 */
function getJSONDictionary(json: string) {
  const dictionary: Dictionary = {}

  // reserved by booleans
  dictionary['false'] = 0
  dictionary['true'] = 1

  let dictionaryIndex = 2
  JSON.parse(json, (key, value) => {
    // we store the key in the alias dictionary, to alias it to a hex key
    if (dictionary[`"${key}"`] === undefined) {
      dictionary[`"${key}"`] = dictionaryIndex++
    }

    // we store the value in the alias dictionary, to alias it to a hex key
    if (typeof value === 'string' && dictionary[`"${value}"`] === undefined) {
      dictionary[`"${value}"`] = dictionaryIndex++
    }

    return value
  })

  return dictionary
}

/**
 * Replaces occurrences as described by the dictionary. Basically, this is a
 * tool that can either compress or decompress a JSON.
 * @param json
 * @param dictionary
 * @returns
 */
export function translateJSONString(json: string, dictionary: Dictionary) {
  let compressedJSON = json

  for (const key of Object.keys(dictionary)) {
    const keysRegexp = new RegExp(`(?<!\\d)${key}(?!\\d)`, 'g')
    compressedJSON = compressedJSON.replace(keysRegexp, dictionary[key] + '')
  }

  return compressedJSON
}

/**
 * Reverses a dictionary for decompressing via {@link translateJSONString}
 * @param dictionary
 * @returns
 */
function reverseDictionary(dictionary: Dictionary) {
  return Object.keys(dictionary)
}
