import path from 'node:path'

export type CliDistributionIdentity = Readonly<{
  name: 'prisma' | 'prisma7'
  commandName: 'prisma' | 'prisma7'
  packageName: 'prisma' | 'prisma7'
  configPackageName: 'prisma/config' | 'prisma7/config'
}>

const prismaIdentity = Object.freeze({
  name: 'prisma',
  commandName: 'prisma',
  packageName: 'prisma',
  configPackageName: 'prisma/config',
} as const)

const prisma7Identity = Object.freeze({
  name: 'prisma7',
  commandName: 'prisma7',
  packageName: 'prisma7',
  configPackageName: 'prisma7/config',
} as const)

/** Returns the CLI distribution selected by the executable that Node invoked. */
export function getCliDistributionIdentity(executedScript = process.argv[1]): CliDistributionIdentity {
  const normalizedScript = executedScript?.replaceAll('\\', '/')
  const stem = normalizedScript === undefined ? undefined : path.posix.parse(normalizedScript).name

  return stem === 'prisma7' ? prisma7Identity : prismaIdentity
}
