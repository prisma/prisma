import { pathToPosix } from '@prisma/internals'

/**
 * Builds a `dirname` variable that holds the location of the generated client.
 * @param edge
 * @param relativeOutdir
 * @returns
 */
export function buildDirname(edge: boolean, relativeOutdir: string) {
  if (edge === true) {
    return buildDirnameDefault()
  }

  return buildDirnameFind(relativeOutdir)
}

/**
 * Builds a `dirname` variable that will try to locate the generated client.
 * It's useful on serverless envs, where relative output dir can be one step
 * lower because of where and how the code is packaged into the lambda like with
 * a build step for platforms like Vercel or Netlify. On top of that, the
 * feature is especially useful for Next.js/Webpack users since the client gets
 * moved and copied out of its original spot. It all fails, it falls-back to
 * `findSync`, when `__dirname` is not available (eg. bundle, electron) or
 * nothing has been found around `__dirname`.
 *
 * @see /e2e/schema-not-found-sst-electron/readme.md (tests)
 * @param relativeOutdir
 * @param runtimePath
 * @returns
 */
function buildDirnameFind(relativeOutdir: string) {
  return `
const fs = require('fs')

config.dirname = __dirname
if (!fs.existsSync(path.join(__dirname, 'schema.prisma'))) {
  const alternativePaths = [
    ${JSON.stringify(pathToPosix(relativeOutdir))},
    ${JSON.stringify(pathToPosix(relativeOutdir).split('/').slice(1).join('/'))},
  ]
  
  const alternativePath = alternativePaths.find((altPath) => {
    return fs.existsSync(path.join(process.cwd(), altPath, 'schema.prisma'))
  }) ?? alternativePaths[0]

  config.dirname = path.join(process.cwd(), alternativePath)
  config.isBundled = true
}`
}

/**
 * Builds a simple `dirname` for when it is not important to have one.
 * @returns
 */
function buildDirnameDefault() {
  return `config.dirname = '/'`
}
