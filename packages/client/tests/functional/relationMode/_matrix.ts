import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'
import { computeMatrix } from '../_utils/relationMode/computeMatrix'

const RelationModeEnv = process.env.RELATION_MODE
if (RelationModeEnv && RelationModeEnv !== 'prisma' && RelationModeEnv !== 'foreignKeys') {
  throw new Error(`RelationMode must be either "prisma" or "foreignKeys" but was "${RelationModeEnv}"`)
}

type RelationMode = 'prisma' | 'foreignKeys' | ''
const relationMode: RelationMode = (RelationModeEnv as RelationMode) || ''

// Note: testing 'SetDefault' requires a relation with a scalar field having the "@default" attribute.
// If no defaults are provided for any of the scalar fields, a runtime error will be thrown.
//
// Note: 'Restrict' is not available when using 'sqlserver' as a provider, and it triggers a schema parsing error arising from DMMF.
//
// Note: 'SetNull' is only available on optional relations.
//
// Note: 'SetDefault' is making SQL Server crash badly
//  const referentialActionsChoices = ['', 'Cascade', 'NoAction']

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
