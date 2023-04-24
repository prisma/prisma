/**
 * Builds a `dirname` variable that holds the location of the generated client.
 * @param edge
 * @param relativeOutdir
 * @param runtimeDir
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
 * @param relativeOutdir
 * @param runtimePath
 * @returns
 */
function buildDirnameFind(relativeOutdir: string) {
  return `
const fs = require('fs')

let dirname = __dirname
if (!fs.existsSync(path.join(__dirname, 'schema.prisma'))) {
  dirname = path.join(process.cwd(), ${JSON.stringify(relativeOutdir)}
}`
}

/**
 * Builds a simple `dirname` for when it is not important to have one.
 * @returns
 */
function buildDirnameDefault() {
  return `const dirname = '/'`
}
