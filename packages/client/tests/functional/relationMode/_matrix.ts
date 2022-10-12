import { defineMatrix } from '../_utils/defineMatrix'
import { computeMatrix } from '../_utils/relationMode/computeMatrix'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

const defaultMatrix = computeMatrix({ relationMode })

export default defineMatrix(() => [
  [...defaultMatrix],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
