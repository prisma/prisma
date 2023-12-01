import { arg, Command, isError } from '@prisma/internals'

import {
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
} from '../../utils/platform'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
      '--apikey': String,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)

    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
    const apikey = getRequiredParameter(args, ['--apikey'])
    if (isError(apikey)) return apikey

    return platformRequestOrThrow({
      token,
      path: `/${workspace}/${project}/settings/api-keys`,
      route: '_app.$organizationId_.$projectId.settings.api-keys',
      payload: {
        id: apikey,
      },
    }) as Promise<any>
  }
}
