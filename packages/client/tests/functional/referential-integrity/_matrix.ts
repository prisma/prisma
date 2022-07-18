import { defineMatrix } from '../_utils/defineMatrix'
import { Providers } from '../_utils/providers'

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
const referentialActionsChoices = ['', 'Cascade', 'NoAction']

// TODO: generate the referentialActions combinations matrix outside, and merge it to the defined matrix below
export default defineMatrix(() => [
  [
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      },
    },
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'Cascade',
        onDelete: 'Cascade',
      },
    },
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'NoAction',
        onDelete: 'NoAction',
      },
    },
    /*
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'Restrict',
        onDelete: 'Restrict',
      },
    },
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'NoAction',
        onDelete: 'NoAction',
      },
    },
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: 'SetNull',
        onDelete: 'SetNull',
      },
    },
    */
    /*
    {
      provider: Providers.MYSQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      },
    },
    {
      provider: Providers.MONGODB,
      id: 'String @id @map("_id")',
      referentialIntegrity,
      referentialActions: {
        onUpdate: '',
        onDelete: '',
      },
    },
    */
  ],
  [
    {
      previewFeatures: '"referentialIntegrity"',
    },
  ],
])
