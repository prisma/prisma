import fs from 'fs'
import path from 'path'

export const cliTypesStubContents = 'module.exports = {}\n'

/**
 * Keep the package root export resolvable without turning `require("prisma")`
 * into an alias for the CLI entrypoint.
 */
export async function writeCliTypesStub(buildDir = './build') {
  await fs.promises.mkdir(buildDir, { recursive: true })
  await fs.promises.writeFile(path.join(buildDir, 'types.js'), cliTypesStubContents)
}
