/**
 * Decode the contents from an `inlineSchema`
 * @param inlineSchema
 * @returns
 */
export function decodeInlineSchema(inlineSchema: string) {
  return Buffer.from(inlineSchema, 'base64').toString()
}
