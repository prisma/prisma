import { ClientEngineType } from '@prisma/sdk'
import path from 'path'

/**
 * Builds a `dirname` variable that holds the location of the generated client.
 * @param clientEngineType
 * @param relativeOutdir
 * @param runtimeDir
 * @returns
 */
export function buildDirname(clientEngineType: ClientEngineType, relativeOutdir: string, runtimeDir: string) {
  if (clientEngineType !== ClientEngineType.DataProxy) {
    return buildDirnameFind(relativeOutdir, runtimeDir)
  }

  return buildDirnameDefault()
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
 * @param defaultRelativeOutdir
 * @param runtimePath
 * @returns
 */
function buildDirnameFind(defaultRelativeOutdir: string, runtimePath: string) {
  // potential client location on serverless envs
  const serverlessRelativeOutdir = defaultRelativeOutdir.split(path.sep).slice(1).join(path.sep)

  return `
const { findSync } = require('${runtimePath}')

const hasDirname = typeof __dirname !== 'undefined' && __dirname !== '/'

// will work in most cases, ie. if the client has not been bundled
const regularDirname = hasDirname ? path.dirname(findSync(__dirname, [
    ${JSON.stringify('schema.prisma')},
], ['f'], ['d'], 1)[0] || '') : undefined

// if the client has been bundled, we need to look for the folder
const foundDirname = findSync(process.cwd(), [
    ${defaultRelativeOutdir ? `${JSON.stringify(defaultRelativeOutdir)},` : ''}
    ${serverlessRelativeOutdir ? `${JSON.stringify(serverlessRelativeOutdir)},` : ''}
], ['d'], ['d'], 1)[0]

const dirname = regularDirname || foundDirname || __dirname`
}
// TODO: 👆 all this complexity could fade away if we embed the schema

/**
 * Builds a simple `dirname` for when it is not important to have one.
 * @returns
 */
function buildDirnameDefault() {
  return `const dirname = '/'`
}
