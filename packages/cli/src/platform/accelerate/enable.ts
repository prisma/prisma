import { arg, Command, isError } from '@prisma/internals'

import {
  generateConnectionString,
  getOptionalParameter,
  getPlatformTokenOrThrow,
  getRequiredParameter,
  platformParameters,
  platformRequestOrThrow,
  successMessage,
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
    if (isError(url)) return url
    const apikey = getOptionalParameter(args, ['--apikey'])
    if (isError(apikey)) return apikey
    const accelerateSetupPayload = await platformRequestOrThrow<{
      data: {}
      error: { message: string } | null
    }>({
      token,
      path: `/${workspace}/${project}/accelerate/setup`,
      route: '_app.$organizationId_.$projectId.accelerate.setup',
      payload: {
        intent: 'enable',
        connectionString: url,
      },
    })
    if (accelerateSetupPayload.error) {
      throw new Error(accelerateSetupPayload.error.message)
    }
    if (apikey) {
      const payload = await platformRequestOrThrow<{
        data: {
          tenantAPIKey: string
        }
        error: null | { message: string }
      }>({
        token,
        path: `/${workspace}/${project}/settings/api-keys/create`,
        route: '_app.$organizationId_.$projectId.settings.api-keys.create',
        payload: {},
      })
      if (payload.error?.message) {
        throw new Error(payload.error.message)
      }
      return successMessage(
        `Accelerate enabled. Use this generated API key in your Accelerate connection string to authenticate requests: \n${generateConnectionString(
          payload.data.tenantAPIKey,
        )}`,
      )
    } else {
      return successMessage(
        `Accelerate enabled. Use your secure API key in your Accelerate connection string to authenticate requests.`,
      )
    }
  }
}
