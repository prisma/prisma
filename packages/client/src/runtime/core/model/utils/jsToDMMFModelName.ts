/**
 * Transforms a model name coming from the runtime to a DMMF model name.
 * @param name
 * @returns
 */
export function jsToDMMFModelName(name: string) {
  return name.replace(/^./, (str) => str.toUpperCase())
}
