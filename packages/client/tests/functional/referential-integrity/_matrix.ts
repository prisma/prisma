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
const referentialActionsChoices = ['', 'Cascade', 'Restrict', 'NoAction', 'SetNull']

// TODO: generate the referentialActions combinations matrix outside, and merge it to the defined matrix below
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        // onUpdate: '',
        // onDelete: '',
        // onUpdate: 'Cascade',
        // onDelete: 'Cascade',
        // onUpdate: 'Restrict',
        // onDelete: 'Restrict',
        // onUpdate: 'NoAction',
        // onDelete: 'NoAction',
        // onUpdate: 'SetNull',
        // onDelete: 'SetNull',
        onUpdate: 'SetDefault',
        onDelete: 'SetDefault',
      },
    },
    // {
    //   provider: Providers.MYSQL,
    //   id: 'String @id',
    //   referentialIntegrity,
    //   referentialActions: {
    //     onUpdate: '',
    //     onDelete: '',
    //   },
    // },
    // {
    //   provider: Providers.SQLITE,
    //   id: 'String @id',
    //   referentialIntegrity,
    //   referentialActions: {
    //     onUpdate: '',
    //     onDelete: '',
    //   },
    // },
    // {
    //   provider: Providers.SQLSERVER,
    //   id: 'String @id',
    //   referentialIntegrity,
    //   referentialActions: {
    //     onUpdate: '',
    //     onDelete: '',
    //   },
    // },
    /*
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
