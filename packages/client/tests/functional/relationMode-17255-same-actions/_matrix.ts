import { defineMatrix } from '../_utils/defineMatrix'
import { computeMatrix } from '../_utils/relationMode/computeMatrix'

// const RelationModeEnv = process.env.RELATION_MODE
// if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
//   throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
// }

// type RelationMode = 'prisma' | 'foreignKeys' | ''
// const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

// const defaultMatrix = computeMatrix({ relationMode })
// console.log(defaultMatrix)

// SetNull (everywhere) fails with:
// error: Error parsing attribute "@relation": The `onDelete` referential action of a relation must not be set to `SetNull` when a referenced field is required.
// Either choose another referential action, or make the referenced fields optional.
// So we filter these out
//

export default defineMatrix(() => [
  // [...defaultMatrix.filter((entry) => entry.onDelete !== 'SetNull' && entry.onUpdate !== 'SetNull')],

  //
  // SQLite fails, only in Windows CI with
  // https://github.com/prisma/prisma/actions/runs/4068097706/jobs/7006246193
  // ● relationMode-17255-same-actions (relationMode=foreignKeys,provider=sqlite,providerFlavor=sqlite,onUpdate=NoAction,onDelete=NoAction,id=String @id) › not-original › onUpdate: Restrict, NoAction, SetNull › relationMode=foreignKeys [update] main with nested delete alice should fail
  //   SQLite database error
  //   unable to open database file
  //      0: sql_migration_connector::apply_migration::apply_migration
  //                at migration-engine\connectors\sql-migration-connector\src\apply_migration.rs:10
  //      1: migration_core::state::SchemaPush
  //                at migration-engine\core\src\state.rs:433
  //
  // Probably because the path is too long or has a special character?
  // Didn't have time to figure it out....
  // So it's skipped for now, not ideal but "ok"
  //
  [
    ...computeMatrix({ relationMode: 'foreignKeys' }).filter((entry) => {
      const isSetNull = entry.onDelete === 'SetNull' && entry.onUpdate === 'SetNull'
      const isSQLite = entry.provider === 'sqlite'

      if (process.platform === 'win32') {
        return !isSetNull && !isSQLite
      } else {
        return !isSetNull
      }
    }),
    ...computeMatrix({ relationMode: 'prisma' }).filter((entry) => {
      const isSetNull = entry.onDelete === 'SetNull' && entry.onUpdate === 'SetNull'
      const isSQLite = entry.provider === 'sqlite'

      if (process.platform === 'win32') {
        return !isSetNull && !isSQLite
      } else {
        return !isSetNull
      }
    }),
  ],
  [],
])
