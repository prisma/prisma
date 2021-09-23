import { ClientEngineType } from '../../runtime/utils/getClientEngineType'
import path from 'path'

export function buildDirname(
  clientEngineType: ClientEngineType,
  relativeOutdir: string,
) {
  if (clientEngineType !== ClientEngineType.DataProxy) {
    return buildDirnameFind(relativeOutdir)
  }

  return buildDirnameRelative(relativeOutdir)
}

function buildDirnameFind(relativeOutdir: string) {
  // on serverless envs, relative output dir can be one step lower because of
  // where and how the code is packaged into the lambda like with a build step
  // with platforms like Vercel or Netlify. We want to check this as well.
  const slsRelativeOutputDir = relativeOutdir
    .split(path.sep)
    .slice(1)
    .join(path.sep)

  return `
const { findSync } = require('./runtime')

const dirname = findSync(process.cwd(), [
    ${JSON.stringify(relativeOutdir)},
    ${JSON.stringify(slsRelativeOutputDir)},
], ['d'], ['d'], 1)[0] || __dirname`
}

function buildDirnameRelative(relativeOutdir: string) {
  return `const dirname = '${relativeOutdir}'`
}
