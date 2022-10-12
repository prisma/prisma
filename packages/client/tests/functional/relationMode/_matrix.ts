import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'
import { computeMatrix } from '../_utils/relationMode/computeMatrix'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RELATION_MODE must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

const defaultMatrix = computeMatrix({ relationMode })

const mongoDBMatrixBase = {
  provider: Providers.MONGODB,
  id: 'String @id @map("_id")',
  relationMode,
}

// TODO: we can potentially add single entries with "SetNull" and "SetDefault" down here
export default defineMatrix(() => [
  [
    ...defaultMatrix,

    // MongoDB starts here
    // Note: SetDefault emulation is not implemented
    {
      ...mongoDBMatrixBase,
      onUpdate: 'DEFAULT',
      onDelete: 'DEFAULT',
    },
    {
      ...mongoDBMatrixBase,
      onUpdate: 'Cascade',
      onDelete: 'Cascade',
    },
    {
      ...mongoDBMatrixBase,
      onUpdate: 'NoAction',
      onDelete: 'NoAction',
    },
    {
      ...mongoDBMatrixBase,
      onUpdate: 'SetNull',
      onDelete: 'SetNull',
    },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
