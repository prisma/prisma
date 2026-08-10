export const prismaCliEntrypoint = 'prisma/build/index.js'

export function delegateToPrismaCli(loadPrismaCli: () => unknown = () => require(prismaCliEntrypoint)): unknown {
  return loadPrismaCli()
}
