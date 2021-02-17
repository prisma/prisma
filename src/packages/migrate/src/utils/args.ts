export function getTerminatedOptions(argv: string[]): string[] {
  const terminatorIndex = argv.indexOf('--')
  const args = terminatorIndex !== -1 ? argv.slice(terminatorIndex + 1) : []
  return args
}
