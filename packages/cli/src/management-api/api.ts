import { createManagementApiClient } from './client'
import type { operations } from './openapi'

export class ManagementApiError extends Error {
  readonly code: string

  constructor({ code, message }: { code: string; message: string }) {
    super(message)
    this.code = code
  }
}

export type Region = NonNullable<operations['postV1Projects']['requestBody']>['content']['application/json']['region']

export class ManagementApi {
  #client: ReturnType<typeof createManagementApiClient>

  constructor(client: ReturnType<typeof createManagementApiClient>) {
    this.#client = client
  }

  async getRegions() {
    const { data, error } = await this.#client.GET('/v1/regions/postgres')
    if (error) {
      throw new ManagementApiError(error.error)
    }
    return data.data
  }

  async createProjectWithDatabase(name: string, region: Region) {
    const { data, error } = await this.#client.POST('/v1/projects', {
      body: {
        createDatabase: true,
        name,
        region,
      },
    })
    if (error) {
      throw new ManagementApiError(error.error)
    }
    return data.data
  }
}
