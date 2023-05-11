import { TSClientOptions } from '../TSClient/TSClient'

/**
 * Builds a `dirname` variable that holds the location of the generated client.
 * @param edge
 * @param relativeOutdir
 * @param runtimeDir
 * @returns
 */
export function buildDirname({ edge, esm }: TSClientOptions, relativeOutdir: string) {
  if (edge === true) {
    return buildDirnameDefault()
  }

  return buildDirnameFind(esm, relativeOutdir)
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
function buildDirnameFind(esm: boolean, relativeOutdir: string) {
  let dirname = ''
  if (esm === true) {
    dirname = `new URL('.', import.meta.url).pathname`
  } else {
    dirname = `__dirname`
  }

  return `
config.dirname = ${dirname}
if (!fs.existsSync(path.join(config.dirname, 'schema.prisma'))) {
  warnOnce('bundled-warning-1', 'Your generated Prisma Client could not immediately find its \`schema.prisma\`, falling back to finding it via the current working directory.')
  warnOnce('bundled-warning-2', 'We are interested in learning about your project setup. We\\'d appreciate if you could take the time to share some information with us.')
  warnOnce('bundled-warning-3', 'Please help us by answering a few questions: https://pris.ly/bundler-investigation')
  config.dirname = path.join(process.cwd(), ${JSON.stringify(relativeOutdir)})
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
