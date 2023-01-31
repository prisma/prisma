import { defineMatrix } from '../_utils/defineMatrix'
import { computeMatrix } from '../_utils/relationMode/computeMatrix'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

const defaultMatrix = computeMatrix({ relationMode })
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
      return entry.onDelete === 'Cascade' && entry.onUpdate === 'Cascade'
    }),
  ],
  [],
])
