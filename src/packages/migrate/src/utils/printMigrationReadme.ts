import { createPatch } from 'diff'
import getEmail from 'git-user-email'
import getUserName from 'git-user-name'
import { DatabaseStep } from '../types'
import { printDetailedDatabaseSteps } from './printDatabaseSteps'
import { maskSchema } from '@prisma/sdk'

export interface MigrationReadmeInput {
  migrationId: string
  lastMigrationId: string
  datamodelA: string
  datamodelB: string
  databaseSteps: DatabaseStep[]
}

export function printMigrationReadme({
  migrationId,
  lastMigrationId,
  datamodelA,
  datamodelB,
  databaseSteps,
}: MigrationReadmeInput): string {
  const user = getUserName()
  const email = getEmail()
  let byStr = ''
  if (user) {
    byStr = ` by ${user}`
    if (email) {
      byStr += ` <${email}>`
    }
  }
  return `\
# Migration \`${migrationId}\`

This migration has been generated${byStr} at ${new Date().toLocaleString(
    'en-US',
  )}.
You can check out the [state of the schema](./schema.prisma) after the migration.

## Database Steps

\`\`\`sql
${printDetailedDatabaseSteps(databaseSteps)}
\`\`\`

## Changes

\`\`\`diff
${maskSchema(
  makePatch({
    migrationId,
    lastMigrationId,
    datamodelA,
    datamodelB,
    databaseSteps,
  }),
)}
\`\`\`

${
  /*## Prisma Client Usage

You can use a specific Prisma Client built for this migration (${migrationId})
in your \`before\` or \`after\` migration script like this:

\`\`\`ts
import PrismaClient from '@prisma/client/${migrationId}'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.users()
  console.dir(result, { depth: null })
}

main()

\`\`\`
*/ ''
}
`
}

function makePatch({
  datamodelA,
  datamodelB,
  migrationId,
  lastMigrationId,
}: MigrationReadmeInput): string {
  const patch = createPatch('datamodel.dml', datamodelA, datamodelB)
  const header = `diff --git schema.prisma schema.prisma
migration ${lastMigrationId}..${migrationId}\n`
  return header + filterUselessLines(patch)
}

function filterUselessLines(patch: string): string {
  return patch
    .split('\n')
    .slice(2)
    .filter((line) => {
      if (line.startsWith('\\ No newline')) {
        return false
      }
      if (line.trim() === '') {
        return false
      }
      return true
    })
    .join('\n')
}
