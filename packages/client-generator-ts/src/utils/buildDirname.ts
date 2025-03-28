/**
 * Builds a `dirname` variable that holds the location of the generated client.
 */
export function buildDirname(edge: boolean) {
  if (edge === true) {
    return `config.dirname = '/'`
  }

  return `config.dirname = __dirname`
}
