import { arg, Command, isError } from '@prisma/internals'

import { getPlatformTokenOrThrow, platformParameters, platformRequestOrThrow } from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.global,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const payload = await platformRequestOrThrow<{
      actor: any
      organizations: {
        id: string
        displayName: string
        createdAt: string
      }[]
    }>({
      token,
      path: `/settings/workspaces`,
      route: '_app._user.settings.workspaces',
    })

    console.table(
      payload.organizations.map((workspace) => ({
        id: workspace.id,
        name: workspace.displayName,
        createdAt: workspace.createdAt,
      })),
      ['id', 'name', 'createdAt'],
    )
    return ''
  }
}
