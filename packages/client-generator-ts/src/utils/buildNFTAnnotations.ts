import { ClientEngineType } from '@prisma/internals'

// NFT is the Node File Trace utility by Vercel https://github.com/vercel/nft

/**
 * Build bundler-like annotations so that Vercel automatically uploads the
 * prisma schema to the deployments.
 * @param engineType the client engine in use
 * @param relativeOutdir outdir relative to root
 * @returns
 */
export function buildNFTAnnotations(_noEngine: boolean, _engineType: ClientEngineType, _relativeOutdir: string) {
  // Client engine type does not require bundling engine binaries
  return ''
}
