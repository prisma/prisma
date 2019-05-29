import { createPatch } from 'diff'

export type MigrationReadmeInput = {
  migrationId: string
  lastMigrationId: string
  datamodelA: string
  datamodelB: string
}

export function printMigrationReadme({
  migrationId,
  lastMigrationId,
  datamodelA,
  datamodelB,
}: MigrationReadmeInput) {
  return `\
# Migration \`${migrationId}\`

## Changes

\`\`\`diff
${makePatch({ migrationId, lastMigrationId, datamodelA, datamodelB })}
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
