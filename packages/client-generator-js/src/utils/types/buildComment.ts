/**
 * Build comments for generating ts docs
 * @param documentation
 * @returns
 */
export function buildComment(documentation?: string) {
  if (documentation === undefined) return ''

  const docLines = documentation.split('\n')
  const docBody = docLines.reduce((acc, item) => {
    return `${acc}\n * ${item}`
  }, '')

  return `/**${docBody}\n */
`
}
