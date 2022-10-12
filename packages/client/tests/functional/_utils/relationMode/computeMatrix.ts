import { Providers } from '../providers'

type ComputeMatrix = {
  relationMode: 'prisma' | 'foreignKeys' | ''
  providersDenyList?: Providers[]
}

export function computeMatrix({ relationMode, providersDenyList }: ComputeMatrix) {
  const providersBase = [
    Providers.POSTGRESQL,
    Providers.COCKROACHDB,
    Providers.SQLSERVER,
    Providers.MYSQL,
    Providers.SQLITE,
  ] as const
  // Note: SetDefault is not implemented in the emulation (relationMode="prisma")

  // Note: testing 'SetDefault' requires a relation with a scalar field having the "@default" attribute.
  // If no defaults are provided for any of the scalar fields, a runtime error will be thrown.
  // Also 'SetDefault' is making SQL Server crash badly for example
  // See https://www.notion.so/prismaio/Phase-1-Report-on-findings-f21c7bb079c5414296286973fdcd62c2#ac4d9f6a5d3842b5b6ff5b877e7e6782

  const referentialActionsBase = ['DEFAULT', 'Cascade', 'NoAction', 'Restrict', 'SetNull'] as const

  const providers = providersBase.filter((provider) => !(providersDenyList || []).includes(provider))

  // "foreignKeys"
  //
  // 'Restrict' on SQL Server is not available and it triggers a schema parsing error.
  // See in our docs https://pris.ly/d/relationMode
  //
  // `SetNull` with non-optional relations (= our 1:1, 1:n and m:n in this project) is invalid
  // when using Foreign Keys fails with migration errors on MySQL, CockroachDB and SQL Server
  // A schema validation error will be added, see https://github.com/prisma/prisma/issues/14673
  //
  // "prisma"
  //
  // `NoAction` on PostgreSQL / SQLite
  // We made a schema validation error for PostgreSQL and SQLite in https://github.com/prisma/prisma-engines/pull/3274
  // Error code: P1012 error: Error validating: Invalid referential action: `NoAction`. Allowed values: (`Cascade`, `Restrict`, `SetNull`). `NoAction` is not implemented for sqlite when using `relationMode = "prisma"`, you could try using `Restrict` instead. Learn more at https://pris.ly/d/relationMode
  //
  // We skip these combinations in the matrix (= filtering them out)

  const referentialActionsDenylistByProvider = {
    foreignKeys: {
      [Providers.SQLSERVER]: ['Restrict', 'SetNull'],
      [Providers.COCKROACHDB]: ['SetNull'],
      [Providers.MYSQL]: ['SetNull'],
    },
    prisma: {
      [Providers.SQLSERVER]: ['Restrict', 'SetNull'],
      [Providers.COCKROACHDB]: ['SetNull'],
      [Providers.MYSQL]: ['SetNull'],
      [Providers.POSTGRESQL]: ['NoAction'],
      [Providers.SQLITE]: ['NoAction'],
    },
  }

  const providersMatrix = providers.map((provider) => ({
    provider,
    id: 'String @id',
    relationMode,
  }))

  const referentialActionsMatrix = providersMatrix.flatMap((entry) => {
    const denyList = referentialActionsDenylistByProvider[relationMode || 'foreignKeys'][entry.provider] || []
    const referentialActions = referentialActionsBase.filter((action) => !denyList.includes(action))

    return referentialActions.map((referentialAction) => ({
      ...entry,
      onUpdate: referentialAction,
      onDelete: referentialAction,
    }))
  })

  return referentialActionsMatrix
}
