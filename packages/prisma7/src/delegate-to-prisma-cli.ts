const distributionMarker = '__PRISMA_CLI_DISTRIBUTION'

export const prismaCliEntrypoint = 'prisma/build/index.js'

export function delegateToPrismaCli(loadPrismaCli: () => unknown = () => require(prismaCliEntrypoint)): unknown {
  process.env[distributionMarker] = 'prisma7'
  return loadPrismaCli()
}
