import type { BinaryTarget } from '@prisma/get-platform'
import { getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType, parseAWSNodejsRuntimeEnvVarVersion, pathToPosix } from '@prisma/internals'
import path from 'node:path'

import { map } from '../../../../../helpers/blaze/map'

// NFT is the Node File Trace utility by Vercel https://github.com/vercel/nft

/**
 * Build bundler-like annotations so that Vercel automatically uploads the
 * prisma schema as well as the query engine binaries to the deployments.
 * @param engineType the client engine in use
 * @param binaryTargets the targeted binaryTargets
 * @param relativeOutdir outdir relative to root
 * @returns
 */
export function buildNFTAnnotations(
  noEngine: boolean,
  engineType: ClientEngineType,
  binaryTargets: BinaryTarget[] | undefined,
  relativeOutdir: string,
) {
  // We don't want to bundle engines when `--no-engine is enabled or for the edge runtime
  if (noEngine === true) return ''

  if (binaryTargets === undefined) {
    // TODO: should we still build the schema annotations in this case?
    // Or, even better, make binaryTargets non-nullable in TSClientOptions to avoid this check.
    return ''
  }

  // Add annotation for Netlify for a specific binaryTarget (depending on Node version and special env var)
  if (process.env.NETLIFY) {
    const isNodeMajor20OrUp = Number.parseInt(process.versions.node.split('.')[0]) >= 20

    // Netlify reads and changes the runtime version based on this env var
    // https://docs.netlify.com/configure-builds/environment-variables/#netlify-configuration-variables
    const awsRuntimeVersion = parseAWSNodejsRuntimeEnvVarVersion()
    const isRuntimeEnvVar20OrUp = awsRuntimeVersion && awsRuntimeVersion >= 20
    const isRuntimeEnvVar18OrDown = awsRuntimeVersion && awsRuntimeVersion <= 18

    // Only set to 3.0.x if
    // - current Node.js version is 20+ or env var is 20+
    // - env var must not be 18-
    if ((isNodeMajor20OrUp || isRuntimeEnvVar20OrUp) && !isRuntimeEnvVar18OrDown) {
      binaryTargets = ['rhel-openssl-3.0.x']
    } else {
      binaryTargets = ['rhel-openssl-1.0.x']
    }
  }

  const engineAnnotations = map(binaryTargets, (binaryTarget) => {
    const engineFilename = getQueryEngineFilename(engineType, binaryTarget)
    return engineFilename ? buildNFTAnnotation(engineFilename, relativeOutdir) : ''
  }).join('\n')

  const schemaAnnotations = buildNFTAnnotation('schema.prisma', relativeOutdir)

  return `${engineAnnotations}${schemaAnnotations}`
}

/**
 * Retrieve the location of the current query engine
 * @param engineType
 * @param binaryTarget
 * @returns
 */
function getQueryEngineFilename(engineType: ClientEngineType, binaryTarget: BinaryTarget) {
  if (engineType === ClientEngineType.Library) {
    return getNodeAPIName(binaryTarget, 'fs')
  }

  if (engineType === ClientEngineType.Binary) {
    return `query-engine-${binaryTarget}`
  }

  return undefined
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
