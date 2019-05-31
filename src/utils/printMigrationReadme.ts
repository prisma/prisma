import { createPatch } from 'diff'
import getUserName from 'git-user-name'
import getEmail from 'git-user-email'
import { DatabaseStep } from '../types'
import { printDetailedDatabaseSteps } from './printDatabaseSteps'

export type MigrationReadmeInput = {
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
}: MigrationReadmeInput) {
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
You can check out the [state of the datamodel](./datamodel.prisma) after the migration.

## Database Steps

\`\`\`sql
${printDetailedDatabaseSteps(databaseSteps)}
\`\`\`

## Changes

\`\`\`diff
${makePatch({
  migrationId,
  lastMigrationId,
  datamodelA,
  datamodelB,
  databaseSteps,
})}
\`\`\`

## Photon Usage

You can use a specific Photon built for this migration (${migrationId})
in your \`before\` or \`after\` migration script like this:

\`\`\`ts
import Photon from '@generated/photon/${migrationId}'

const photon = new Photon()

async function main() {
  const result = await photon.users()
  console.dir(result, { depth: null })
}

main()

\`\`\`
`
}

function makePatch({
  datamodelA,
  datamodelB,
  migrationId,
  lastMigrationId,
}: MigrationReadmeInput) {
  const patch = createPatch('datamodel.dml', datamodelA, datamodelB)
  const header = `diff --git datamodel.mdl datamodel.mdl
migration ${lastMigrationId}..${migrationId}\n`
  return header + filterUselessLines(patch)
}

function filterUselessLines(patch: string) {
  return patch
    .split('\n')
    .slice(2)
    .filter(line => {
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
