import { arg, Command, isError } from '@prisma/internals'
import { log } from 'console'

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
    await platformRequestOrThrow<{
      accelerate: { data: {}; error: null }
      apikey: { data: { serviceKey: { id: string; createdAt: string } } }
    }>({
      token,
      path: `/${workspace}/${project}/accelerate/setup`,
      route: '_app.$organizationId_.$projectId.accelerate.setup',
      payload: {
        intent: 'enable',
        connectionString: url,
      },
    })
    if (apikey) {
      const payload = await platformRequestOrThrow<{
        data: {
          serviceKey: {
            id: string
            createdAt: string
            displayName: string
            valueHint: string
            tenantAPIKey: string
          }
        }
      }>({
        token,
        path: `/${workspace}/${project}/settings/api-keys/create`,
        route: '_app.$organizationId_.$projectId.settings.api-keys.create',
        payload: {
          displayName: 'todo',
        },
      })
      log(
        `Success! Accelerate enabled. Use this generated API key in your Accelerate connection string to authenticate requests: ${payload.data.serviceKey.tenantAPIKey}`,
      )
    } else {
      log(
        `Success! Accelerate enabled. Use your secure API key in your Accelerate connection string to authenticate requests.`,
      )
    }
    return ''
  }
}
