import type { Platform } from '@prisma/get-platform'
import { getNodeAPIName } from '@prisma/get-platform'
import { ClientEngineType } from '@prisma/sdk'
import path from 'path'

import { map } from '../../../../../helpers/blaze/map'

// NFT is the Node File Trace utility by Vercel https://github.com/vercel/nft

/**
 * Build bundler-like annotations so that Vercel automatically uploads the
 * prisma schema as well as the query engine binaries to the deployments.
 * @param engineType the client engine in use
 * @param platforms the targeted platforms
 * @param relativeOutdir outdir relative to root
 * @returns
 */
export function buildNFTAnnotations(
  dataProxy: boolean | undefined,
  engineType: ClientEngineType,
  platforms: Platform[] | undefined,
  relativeOutdir: string,
) {
  // We don't want to bundle engines when `--data-proxy` is enabled
  if (dataProxy === true) return ''

  if (platforms === undefined) {
    // TODO: should we still build the schema annotations in this case?
    // Or, even better, make platforms non-nullable in TSClientOptions to avoid this check.
    return ''
  }

  if (process.env.NETLIFY) {
    platforms = ['rhel-openssl-1.0.x']
  }

  const engineAnnotations = map(platforms, (platform) => {
    return buildNFTEngineAnnotation(engineType, platform, relativeOutdir)
  }).join('\n')

  const schemaAnnotations = buildNFTSchemaAnnotation(engineType, relativeOutdir)

  return `${engineAnnotations}${schemaAnnotations}`
}

/**
 * Retrieve the location of the current query engine
 * @param engineType
 * @param platform
 * @returns
 */
function getQueryEngineFilename(engineType: ClientEngineType, platform: Platform) {
  if (engineType === ClientEngineType.Library) {
    return getNodeAPIName(platform, 'fs')
  }

  if (engineType === ClientEngineType.Binary) {
    return `query-engine-${platform}`
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
path.join(__dirname, ${JSON.stringify(fileName)});
path.join(process.cwd(), ${JSON.stringify(relativeFilePath)})`
}

/**
 * Build an annotation for the prisma client engine files
 * @param engineType
 * @param platform
 * @param relativeOutdir
 * @returns
 */
function buildNFTEngineAnnotation(engineType: ClientEngineType, platform: Platform, relativeOutdir: string) {
  const engineFilename = getQueryEngineFilename(engineType, platform)

  if (engineFilename === undefined) return ''

  return buildNFTAnnotation(engineFilename, relativeOutdir)
}

/**
 * Build an annotation for the prisma schema files
 * @param engineType
 * @param relativeOutdir
 * @returns
 */
function buildNFTSchemaAnnotation(engineType: ClientEngineType, relativeOutdir: string) {
  if (engineType === ClientEngineType.Library || engineType === ClientEngineType.Binary) {
    return buildNFTAnnotation('schema.prisma', relativeOutdir)
  }

  return undefined
}
