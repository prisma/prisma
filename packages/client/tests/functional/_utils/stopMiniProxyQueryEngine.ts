import Debug from '@prisma/debug'
import nodeFetch from 'node-fetch'

import type { Client } from '../../../src/runtime/getPrismaClient'
import { DatasourceInfo } from './setupTestSuiteEnv'

const debug = Debug('prisma:test:stop-engine')

export async function stopMiniProxyQueryEngine(client: Client, datasourceInfo: DatasourceInfo): Promise<void> {
  const config = client._engineHandler._engineConfig
  const url = new URL(datasourceInfo.remoteEngineUrl!)

  debug('stopping mini-proxy query engine at', url.host)

  const response = await nodeFetch(`https://${url.host}/_mini-proxy/0.0.0/${config.inlineSchemaHash}/stop-engine`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${url.searchParams.get('api_key')}`,
    },
  })

  debug('response status', response.status)
}
