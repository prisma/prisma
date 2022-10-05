import { Providers } from '../providers'

type ComputeMatrix = {
  relationMode: string
  providersBlackList?: Providers[]
}

export function computeMatrix({ relationMode, providersBlackList }: ComputeMatrix) {
  const providersBase = [
    Providers.POSTGRESQL,
    Providers.COCKROACHDB,
    Providers.SQLSERVER,
    Providers.MYSQL,
    Providers.SQLITE,
  ] as const
  //  Note SetDefault is not implemented in the emulation
  const referentialActionsBase = ['DEFAULT', 'Cascade', 'NoAction', 'Restrict'] as const

  const providers = providersBase.filter((provider) => !(providersBlackList || []).includes(provider))

  const referentialActionsBlacklistByProvider = {
    // 'Restrict' is not available when using 'sqlserver' as a provider, and it triggers a schema parsing error arising from DMMF.
    [Providers.SQLSERVER]: ['Restrict'],
  }

  const providersMatrix = providers.map((provider) => ({
    provider,
    id: 'String @id',
    relationMode,
  }))

  const referentialActionsMatrix = providersMatrix.flatMap((entry) => {
    const blackList = referentialActionsBlacklistByProvider[entry.provider] || []
    const referentialActions = referentialActionsBase.filter((action) => !blackList.includes(action))

    return referentialActions.map((referentialAction) => ({
      ...entry,
      onUpdate: referentialAction,
      onDelete: referentialAction,
    }))
  })

  return referentialActionsMatrix
}
