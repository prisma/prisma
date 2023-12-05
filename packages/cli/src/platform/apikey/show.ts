import { arg, Command, isError } from '@prisma/internals'

import {
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
} from '../../utils/platform'

export class Show implements Command {
  public static new(): Show {
    return new Show()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
    const payload = await platformRequestOrThrow<{
      serviceKeys: { createdAt: string; displayName: string; id: string }[]
    }>({
      token,
      path: `/${workspace}/${project}/settings/api-keys`,
      route: '_app.$organizationId_.$projectId.settings.api-keys',
    })
    console.table(
      payload.serviceKeys.map(({ id, displayName, createdAt }) => ({ id, createdAt, name: displayName })),
      ['id', 'name', 'createdAt'],
    )
    return ''
  }
}
