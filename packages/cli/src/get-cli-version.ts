import Debug from '@prisma/debug'

const debug = Debug('prisma:cli:get-cli-version')

export function getCliVersion(): string {
  try {
    // eval keeps esbuild from inlining the require; the path resolves relative
    // to src in development and to the built CLI bundle in production.
    return eval(`require('../package.json')`).version
  } catch (err) {
    debug(`Failed to read the CLI version from package.json: ${err}`)
    return 'unknown'
  }
}
