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
export default defineMatrix(() => [
  // [...defaultMatrix.filter((entry) => entry.onDelete !== 'SetNull' && entry.onUpdate !== 'SetNull')],
  [
    ...computeMatrix({ relationMode: 'foreignKeys' }).filter(
      (entry) => entry.onDelete !== 'SetNull' && entry.onUpdate !== 'SetNull',
    ),
    ...computeMatrix({ relationMode: 'prisma' }).filter(
      (entry) => entry.onDelete !== 'SetNull' && entry.onUpdate !== 'SetNull',
    ),
  ],
  [],
])
