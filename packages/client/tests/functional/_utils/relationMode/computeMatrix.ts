import { Providers } from '../providers'

type ComputeMatrix = {
  relationMode: string
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
  //  Note SetDefault is not implemented in the emulation
  const referentialActionsBase = ['DEFAULT', 'Cascade', 'NoAction', 'Restrict', 'SetNull'] as const

  const providers = providersBase.filter((provider) => !(providersDenyList || []).includes(provider))

  const referentialActionsDenylistByProvider = {
    // 'Restrict' is not available when using 'sqlserver' as a provider, and it triggers a schema parsing error arising from DMMF.
    [Providers.SQLSERVER]: ['Restrict'],
  }

  const providersMatrix = providers.map((provider) => ({
    provider,
    id: 'String @id',
    relationMode,
  }))

  const referentialActionsMatrix = providersMatrix.flatMap((entry) => {
    const denyList = referentialActionsDenylistByProvider[entry.provider] || []
    let referentialActions = referentialActionsBase.filter((action) => !denyList.includes(action))

    if (relationMode !== 'prisma' && [Providers.MYSQL, Providers.COCKROACHDB].includes(entry.provider)) {
      // For 1:1/1:n tests
      //
      // CockroachDB errors with:
      // 1:1 - ERROR: cannot add a SET NULL cascading action on column "cl8y8lubt0000634p91cigsy4.public.ProfileOneToOne.userId" which has a NOT NULL constraint
      // 1:n - ERROR: cannot add a SET NULL cascading action on column "cl8ya9ab30004xl4p4x7h8wuw.public.PostOneToMany.authorId" which has a NOT NULL constraint
      // m:n - ERROR: cannot add a SET NULL cascading action on column "cl8yby0am0004qg4p6utsdh1i.public.CategoriesOnPostsManyToMany.postId" which has a NOT NULL constraint

      // MySQL errors with:
      // 1:1 - Can't create table `cl8y7xlzb000epx4p3o5oh6nu`.`ProfileOneToOne` (errno: 150 "Foreign key constraint is incorrectly formed")
      // 1:n - Can't create table `cl8ya7mfd0004rq4p0uga2d6z`.`PostOneToMany` (errno: 150 "Foreign key constraint is incorrectly formed")
      // m:n - Can't create table `cl8ybu3ni0004eo4p9xeubq4u`.`CategoriesOnPostsManyToMany` (errno: 150 "Foreign key constraint is incorrectly formed")
      //
      // SQL Server errors with:
      // TODO
      referentialActions = referentialActionsBase.filter((action) => action !== 'SetNull')
    }

    return referentialActions.map((referentialAction) => ({
      ...entry,
      onUpdate: referentialAction,
      onDelete: referentialAction,
    }))
  })

  return referentialActionsMatrix
}
