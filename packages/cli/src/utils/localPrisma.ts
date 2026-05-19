import fs from 'node:fs'
import path from 'node:path'

import { confirm } from '@inquirer/prompts'
import { bold, yellow } from 'kleur/colors'

import { canPrompt } from '@prisma/internals'

export function findLocalPrismaBin(baseDir: string): string | null {
  const candidates = [
    path.join(baseDir, 'node_modules', '.bin', 'prisma'),
    path.join(baseDir, 'node_modules', '.bin', 'prisma.cmd'),
    path.join(baseDir, 'node_modules', '.bin', 'prisma.ps1'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export async function confirmUsingGlobalPrisma(commandName: string, baseDir: string): Promise<boolean> {
  const localPrismaBin = findLocalPrismaBin(baseDir)

  if (!localPrismaBin) {
    return true
  }

  console.warn(
    `${yellow(bold('warn'))} Found a local Prisma CLI at ${localPrismaBin}. ` +
      `This command is running the global Prisma CLI for \`prisma ${commandName}\`.`,
  )

  if (!canPrompt()) {
    console.warn(`${yellow(bold('warn'))} Re-run this command with the local Prisma CLI, for example \`npx prisma ${commandName}\`.`)
    return false
  }

  return confirm({
    message: 'Use the global Prisma CLI anyway?',
    default: false,
  })
}
