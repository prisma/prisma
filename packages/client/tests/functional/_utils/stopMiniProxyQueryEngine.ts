import Debug from '@prisma/debug'
import { fetch } from 'undici'

import type { Client } from '../../../src/runtime/getPrismaClient'
import type { DatasourceInfo } from './setupTestSuiteEnv'

const debug = Debug('prisma:test:stop-engine')

export async function stopMiniProxyQueryEngine({
  client,
  datasourceInfo,
}: {
  client: Client
  datasourceInfo: DatasourceInfo
}): Promise<void> {
  const schemaHash = client._engineConfig.inlineSchemaHash
  const url = new URL(datasourceInfo.dataProxyUrl!)

  debug('stopping mini-proxy query engine at', url.host)

  const response = await fetch(`https://${url.host}/_mini-proxy/0.0.0/${schemaHash}/stop-engine`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${url.searchParams.get('api_key')}`,
    },
  })

  debug('response status', response.status)
}
