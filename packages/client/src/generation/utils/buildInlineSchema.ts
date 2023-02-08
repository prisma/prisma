import { SchemaLoader } from '@prisma/internals'
import crypto from 'crypto'

/**
 * Builds an inline schema for the data proxy client. This is useful because it
 * is designed to run in browser-like environments where `fs` is not available.
 * @param dataProxy
 * @param schemaPath
 * @returns
 */
export async function buildInlineSchema(dataProxy: boolean, schemaPath: string) {
  if (dataProxy === true) {
    const schemaLoader = new SchemaLoader()
    const b64Schema = (await schemaLoader.loadBuffer(schemaPath)).toString('base64')
    const schemaHash = crypto.createHash('sha256').update(b64Schema).digest('hex')

    return `
config.inlineSchema = '${b64Schema}'
config.inlineSchemaHash = '${schemaHash}'`
  }

  return ``
}
