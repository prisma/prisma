import fs from 'node:fs/promises'

import { yellow } from 'kleur/colors'
import { packageUp } from 'package-up'
import semver from 'semver'

import packageJson from '../../package.json'

type LocalPrismaVersions = {
  prisma: string | null
  prismaClient: string | null
}

export async function checkVersionMismatch(cwd: string = process.cwd()): Promise<void> {
  const globalVersion = normalizeVersion(packageJson.version)

  if (!globalVersion) {
    return
  }

  const localVersions = await getLocalPrismaVersions(cwd)
  const localVersion = getMismatchedLocalVersion(globalVersion, localVersions)

  if (!localVersion) {
    return
  }

  console.warn(
    yellow(
      `prisma warn Your global prisma version (${globalVersion}) differs from local version (${localVersion}). Run npm install prisma@${globalVersion} to align.`,
    ),
  )
}

async function getLocalPrismaVersions(cwd: string): Promise<LocalPrismaVersions> {
  try {
    const packageJsonPath = await packageUp({ cwd })

    if (!packageJsonPath) {
      return { prisma: null, prismaClient: null }
    }

    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8')
    const localPackageJson = JSON.parse(packageJsonContent)

    return {
      prisma: normalizeVersion(readPackageVersion(localPackageJson, 'prisma')),
      prismaClient: normalizeVersion(readPackageVersion(localPackageJson, '@prisma/client')),
    }
  } catch {
    return { prisma: null, prismaClient: null }
  }
}

function readPackageVersion(
  packageJsonValue: Record<string, unknown>,
  dependencyName: 'prisma' | '@prisma/client',
): string | null {
  const packageGroups = ['dependencies', 'devDependencies'] as const

  for (const groupName of packageGroups) {
    const group = packageJsonValue[groupName]

    if (!group || typeof group !== 'object') {
      continue
    }

    const version = (group as Record<string, unknown>)[dependencyName]

    if (typeof version === 'string') {
      return version
    }
  }

  return null
}

function getMismatchedLocalVersion(globalVersion: string, localVersions: LocalPrismaVersions): string | null {
  if (localVersions.prisma && !semver.eq(globalVersion, localVersions.prisma)) {
    return localVersions.prisma
  }

  if (localVersions.prismaClient && !semver.eq(globalVersion, localVersions.prismaClient)) {
    return localVersions.prismaClient
  }

  return null
}

function normalizeVersion(version: string | null): string | null {
  if (!version) {
    return null
  }

  return semver.minVersion(version)?.version ?? null
}
