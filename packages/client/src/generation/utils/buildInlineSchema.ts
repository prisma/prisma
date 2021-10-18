import fs from 'fs'
import { ClientEngineType } from '../../runtime/utils/getClientEngineType'

const readFile = fs.promises.readFile

/**
 * Builds an inline schema for the data proxy client. This is useful because it
 * is designed to run in browser-like environments where `fs` is not available.
 * @param clientEngineType
 * @param schemaPath
 * @returns
 */
export async function buildInlineSchema(
  clientEngineType: ClientEngineType,
  schemaPath: string,
) {
  if (clientEngineType === ClientEngineType.DataProxy) {
    const b64Schema = (await readFile(schemaPath)).toString('base64')

    return `
config.inlineSchema = '${b64Schema}'`
  }

  return ``
}
