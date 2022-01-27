/**
 * Transforms a model name coming from the DMMF to a runtime model name.
 * @param name
 * @returns
 */
export function dmmfToJSModelName(name: string) {
  return name.replace(/^./, (str) => str.toLowerCase())
}
