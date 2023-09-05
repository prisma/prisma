import crypto from 'crypto'
import { readFile } from 'fs/promises'

/**
 * Builds an inline schema for the data proxy client. This is useful because it
 * is designed to run in browser-like environments where `fs` is not available.
 * We inline it here rather than in the client config because it could be large
 * and just waste time transforming it into JSON (a small optimization).
 * @param schemaPath
 * @returns
 */
export async function buildInlineSchema(schemaPath: string) {
  const b64Schema = (await readFile(schemaPath)).toString('base64')
  const schemaHash = crypto.createHash('sha256').update(b64Schema).digest('hex')

  return `
config.inlineSchema = '${b64Schema}'
config.inlineSchemaHash = '${schemaHash}'`
}
