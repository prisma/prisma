import fs from 'fs-extra'

/**
 * Load JSON file.
 * Inspired by @link https://github.com/sindresorhus/load-json-file/blob/main/index.js
 * @remark Eventually this helper could be moved to @prisma/internals
 */

type JsonValue = string | number | boolean | null | { [Key in string]?: JsonValue } | JsonValue[]
type Reviver = (this: unknown, key: string, value: unknown) => unknown
type BeforeParse = (data: string) => string
interface Options {
  /** Applies a function to the JSON string before parsing. */
  readonly beforeParse?: BeforeParse
  /**
   * Prescribes how the value originally produced by parsing is transformed, before being returned.
   * See the @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Using_the_reviver_parameter for more.
   */
  readonly reviver?: Reviver
}

const parse = (buffer: Buffer, { beforeParse, reviver }: Options = {}) => {
  let data = new TextDecoder().decode(buffer)
  if (typeof beforeParse === 'function') {
    data = beforeParse(data)
  }
  return JSON.parse(data, reviver)
}

/**
 * Loads a JSON file that removes BOM.
 */
export const loadJsonFile = async <ReturnValueType = JsonValue>(
  filePath: string,
  options?: Options,
): Promise<ReturnValueType> => {
  const buffer = await fs.readFile(filePath)
  return parse(buffer, options)
}
