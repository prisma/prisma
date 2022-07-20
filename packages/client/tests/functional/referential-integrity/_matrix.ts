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
//
// Note: 'SetDefault' is making SQL Server crash badly
//  const referentialActionsChoices = ['', 'Cascade', 'NoAction']

// TODO: generate the referentialActions combinations matrix outside, and merge it to the defined matrix below
type ReferentialActions = 'DEFAULT' | 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault'

/**
 * [foreignKeys] Tests with referential actions that are passing on Postgres, CockroachDB, MySQL, and SQL Server:
 * - [x] DEFAULT
 * - [x] Cascade
 * - [x] NoAction
 * 
 * SetNull causes Rust panics on MySQL, and SQL Server.
 * On CockroachDB, it causes jest to to timeout.
 * On Postgres, it runs fine.
 * 
 * SetDefault causes Rust panics on SQL Server.
 * On CockroachDB, it causes jest to to timeout.
 * On Postgres and MySQL, it runs fine.
 */

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

// TODO: fix mysql issues with Restrict
export default defineMatrix(() => [
  [
    {
      provider: Providers.POSTGRESQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.COCKROACHDB,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.MYSQL,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },

    /*
    {
      provider: Providers.SQLSERVER,
      id: 'String @id',
      referentialIntegrity,
      referentialActions: {
        onUpdate,
        onDelete,
      },
    },
    */
    // {
    //   provider: Providers.MYSQL,
    //   id: 'String @id',
    //   referentialIntegrity,
    //   referentialActions: {
    //     onUpdate,
    //     onDelete,
    //   },
    // },
    // {
    //   provider: Providers.SQLSERVER,
    //   id: 'String @id',
    //   referentialIntegrity,
    //   referentialActions: {
    //     // Restrict is not supported by SQL Server
    //     // TODO we should not run the test intead of switching to default
    //     onUpdate: onUpdate === 'Restrict' ? '' : onUpdate,
    //     onDelete: onDelete === 'Restrict' ? '' : onDelete,
    //   },
    // },
    // {
    //   provider: Providers.SQLITE,
    //   id: 'String @id',
    //   referentialIntegrity,
    //   referentialActions: {
    //     onUpdate,
    //     onDelete,
    //   },
    // },
    /*
    {
      provider: Providers.MONGODB,
      id: 'String @id @map("_id")',
      referentialIntegrity,
      referentialActions: {
        // Note: on MongoDB SetDefault is not supported
        onUpdate: onUpdate === 'SetDefault' ? '' : onUpdate,
        onDelete: onDelete === 'SetDefault' ? '' : onDelete,
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
