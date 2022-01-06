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
 * `__dirname`, which is never available on bundles.
 * @param relativeOutdir
 * @param runtimePath
 * @returns
 */
function buildDirnameFind(relativeOutdir: string, runtimePath: string) {
  // potential client location on serverless envs
  const slsRelativeOutputDir = relativeOutdir.split(path.sep).slice(1).join(path.sep)
  const slsRelativeOutputDirCode = slsRelativeOutputDir ? `\n    ${JSON.stringify(slsRelativeOutputDir)},` : ""

  return `
const { findSync } = require('${runtimePath}')

const dirname = findSync(process.cwd(), [
    ${JSON.stringify(relativeOutdir)},${slsRelativeOutputDirCode}
], ['d'], ['d'], 1)[0] || __dirname`
}

/**
 * Builds a simple `dirname` for when it is not important to have one.
 * @returns
 */
function buildDirnameDefault() {
  return `const dirname = '/'`
}
