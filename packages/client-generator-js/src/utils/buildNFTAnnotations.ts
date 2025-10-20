import { ClientEngineType, pathToPosix } from '@prisma/internals'
import path from 'path'

// NFT is the Node File Trace utility by Vercel https://github.com/vercel/nft

/**
 * Build bundler-like annotations so that Vercel automatically uploads the
 * prisma schema to the deployments.
 * @param noEngine whether engine bundling is disabled
 * @param engineType the client engine in use
 * @param relativeOutdir outdir relative to root
 * @returns
 */
export function buildNFTAnnotations(noEngine: boolean, engineType: ClientEngineType, relativeOutdir: string) {
  // We don't want to bundle when `--no-engine is enabled or for the edge runtime
  if (noEngine === true) return ''

  // Client engine only needs schema.prisma annotation
  return buildNFTAnnotation('schema.prisma', relativeOutdir)
}

/**
 * Build tool annotations in order to make Vercel upload our files
 * The first annotation is general purpose, the second if for now-next.
 * @see https://github.com/vercel/vercel/tree/master/packages/now-next
 * @param fileName
 * @param relativeOutdir
 * @returns
 */
function buildNFTAnnotation(fileName: string, relativeOutdir: string) {
  const relativeFilePath = path.join(relativeOutdir, fileName)

  return `
// file annotations for bundling tools to include these files
path.join(__dirname, ${JSON.stringify(pathToPosix(fileName))});
path.join(process.cwd(), ${JSON.stringify(pathToPosix(relativeFilePath))})`
}
