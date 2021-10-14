import { getJSRuntimeName } from './getJSRuntimeName'

/**
 * Create a SHA256 hash from an `inlineSchema` with the methods available on the
 * runtime. We don't polyfill this so we can keep bundles as small as possible.
 * @param inlineSchema
 * @returns
 */
export async function createSchemaHash(inlineSchema: string) {
  const schemaBuffer = Buffer.from(inlineSchema)
  const jsRuntimeName = getJSRuntimeName()

  if (jsRuntimeName === 'node') {
    const crypto = eval(`require('crypto')`) // don't bundle
    const hash = crypto.createHash('sha256').update(schemaBuffer)

    return hash.digest('hex')
  } else if (jsRuntimeName === 'browser') {
    const hash = await crypto.subtle.digest('SHA-256', schemaBuffer)

    return Buffer.from(hash).toString('hex')
  }

  return ''
}
