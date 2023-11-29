import { arg, Command, isError } from '@prisma/internals'

import {
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
} from '../../utils/platform'

export class Enable implements Command {
  public static new(): Enable {
    return new Enable()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.project,
      '--url': String,
      '--apikey': Boolean,
    })
    if (isError(args)) return args
    const token = await getPlatformTokenOrThrow(args)
    const workspace = getRequiredParameter(args, ['--workspace', '-w'])
    if (isError(workspace)) return workspace
    const project = getRequiredParameter(args, ['--project', '-p'])
    if (isError(project)) return project
    const url = getRequiredParameter(args, ['--url'])
    if (isError(project)) return project
    const apikey = getRequiredParameter(args, ['--apikey'])
    if (isError(apikey)) return apikey
    const accelerate = await platformRequestOrThrow({
      token,
      path: `/${workspace}/${project}/accelerate/setup`,
      route: '_app.$organizationId_.$projectId.accelerate.setup',
      payload: {
        intent: 'enable',
        connectionString: url,
      },
    })
    let apikeyResult: null | object = null
    if (apikey) {
      apikeyResult = await platformRequestOrThrow({
        token,
        path: `/${workspace}/${project}/settings/api-keys/create`,
        route: '_app.$organizationId_.$projectId.settings.api-keys.create',
        payload: {
          displayName: 'todo',
        },
      })
    }
    return {
      accelerate,
      apikey: apikeyResult,
    } as any // todo
  }
}
