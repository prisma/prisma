export type CliDistributionIdentity = Readonly<{
  name: 'prisma' | 'prisma7'
  commandName: 'prisma' | 'prisma7'
  packageName: 'prisma' | 'prisma7'
  configPackageName: 'prisma/config' | 'prisma7/config'
}>

const distributionMarker = '__PRISMA_CLI_DISTRIBUTION'
const identityKey = Symbol.for('prisma.cli.distributionIdentity')

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

export function initializeCliDistributionIdentity(): CliDistributionIdentity {
  const marker = process.env[distributionMarker]
  delete process.env[distributionMarker]

  const existingIdentity = Reflect.get(globalThis, identityKey) as CliDistributionIdentity | undefined
  if (existingIdentity !== undefined) {
    return existingIdentity
  }

  const identity = marker === 'prisma7' ? prisma7Identity : prismaIdentity
  Reflect.set(globalThis, identityKey, identity)
  return identity
}
