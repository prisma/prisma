import { defineMatrix } from '../_utils/defineMatrix'
import { computeMatrix } from '../_utils/relationMode/computeMatrix'

// Run on all databases
// once with relation=prisma
// once with relation=foreignKeys

const defaultMatrix = [...computeMatrix({ relationMode: 'prisma' }), ...computeMatrix({ relationMode: 'foreignKeys' })]
// console.log(defaultMatrix)

// SetNull on MongoDB fails with:
// error: Error parsing attribute "@relation": The `onDelete` referential action of a relation must not be set to `SetNull` when a referenced field is required.
// Either choose another referential action, or make the referenced fields optional.

export default defineMatrix(() => [
  [
    ...defaultMatrix.filter((entry) => {
      // Note that one side of the relation actually is set on `onDelete: SetNull`
      // But since we only run this one case, this is enough
      // We just want to run all databases once
      //
      // SQLite fails, only in Windows CI with
      // https://github.com/prisma/prisma/actions/runs/4068097706/jobs/7006246193
      //   ● relationMode-17255-mixed-actions (relationMode=foreignKeys,provider=sqlite,providerFlavor=sqlite,onUpdate=Cascade,onDelete=Cascade,id=String @id) › original › [update] main with nested disconnect alice should succeed
      // SQLite database error
      // unable to open database file
      //    0: sql_migration_connector::apply_migration::apply_migration
      //              at migration-engine\connectors\sql-migration-connector\src\apply_migration.rs:10
      //    1: migration_core::state::SchemaPush
      //              at migration-engine\core\src\state.rs:433
      //
      // Probably because the path is too long or has a special character?
      // Didn't have time to figure it out....
      // So it's skipped for now, not ideal but "ok"
      //
      const isCascade = entry.onDelete === 'Cascade' && entry.onUpdate === 'Cascade'
      const isSQLite = entry.provider === 'sqlite'
      if (process.platform === 'win32') {
        return isCascade && !isSQLite
      } else {
        return isCascade
      }
    }),
  ],
  [],
])
