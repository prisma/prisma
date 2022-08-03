import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'
import { computeMatrix } from '../_utils/referential-integrity/computeMatrix'

const RI = process.env.RI
if (RI && RI !== 'prisma' && RI !== 'foreignKeys') {
  throw new Error(`RI must be either "prisma" or "foreignKeys" but was "${RI}"`)
}

type RIType = 'prisma' | 'foreignKeys' | ''
const referentialIntegrity: RIType = (RI as RIType) || ''

// Note: testing 'SetDefault' requires a relation with a scalar field having the "@default" attribute.
// If no defaults are provided for any of the scalar fields, a runtime error will be thrown.
//
// Note: 'Restrict' is not available when using 'sqlserver' as a provider, and it triggers a schema parsing error arising from DMMF.
//
// Note: 'SetNull' is only available on optional relations.
//
// Note: 'SetDefault' is making SQL Server crash badly
//  const referentialActionsChoices = ['', 'Cascade', 'NoAction']

// TODO: generate the referentialActions combinations matrix outside, and merge it to the defined matrix below
type ReferentialActions = 'DEFAULT' | 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault'

const onUpdate: ReferentialActions | string = 'DEFAULT'
const onDelete: ReferentialActions | string = 'DEFAULT'
// const onUpdate: ReferentialActions | string = 'Cascade'
// const onDelete: ReferentialActions | string = 'Cascade'
// const onUpdate: ReferentialActions | string = 'Restrict'
// const onDelete: ReferentialActions | string = 'Restrict'
// const onUpdate: ReferentialActions | string = 'NoAction'
// const onDelete: ReferentialActions | string = 'NoAction'
// const onUpdate: ReferentialActions | string = 'SetNull'
// const onDelete: ReferentialActions | string = 'SetNull'
// const onUpdate: ReferentialActions | string = 'SetDefault'
// const onDelete: ReferentialActions | string = 'SetDefault'

const defaultMatrix = computeMatrix({ referentialIntegrity })

const mongoDBMatrixBase = {
  provider: Providers.MONGODB,
  id: 'String @id @map("_id")',
  referentialIntegrity,
}

// TODO: we can potentially add single entries with "SetNull" and "SetDefault" down here
export default defineMatrix(() => [
  [
    ...defaultMatrix,

    // MongoDB starts here
    // Note: SetDefault emulation is not implemented
    {
      ...mongoDBMatrixBase,
      referentialActions: {
        onUpdate: 'DEFAULT',
        onDelete: 'DEFAULT',
      },
    },
    {
      ...mongoDBMatrixBase,
      referentialActions: {
        onUpdate: 'Cascade',
        onDelete: 'Cascade',
      },
    },
    {
      ...mongoDBMatrixBase,
      referentialActions: {
        onUpdate: 'NoAction',
        onDelete: 'NoAction',
      },
    },
    {
      ...mongoDBMatrixBase,
      referentialActions: {
        onUpdate: 'SetNull',
        onDelete: 'SetNull',
      },
    },
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
