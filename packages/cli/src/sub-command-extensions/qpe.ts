import type { GetQueryPlanExecutorServerOptions, QueryPlanExecutorExtension } from '@prisma/cli-context'
import { parseDuration, parseSize, Server, serverRoutes } from '@prisma/query-plan-executor'

export function createQpeExtension(prismaVersion: string): QueryPlanExecutorExtension {
  let server: Server | undefined

  const getServer = async (options: GetQueryPlanExecutorServerOptions): Promise<Server> => {
    server = server ?? (await createServer(options))
    return server
  }

  return {
    allowedClientVersion: prismaVersion,
    routes: serverRoutes,
    getServer,
  }
}

function createServer({ connectionString, debug }: GetQueryPlanExecutorServerOptions) {
  return Server.create({
    databaseUrl: connectionString,
    maxResponseSize: parseSize('128 MiB'),
    queryTimeout: parseDuration('PT5M'),
    maxTransactionTimeout: parseDuration('PT5M'),
    maxTransactionWaitTime: parseDuration('PT5M'),
    perRequestLogContext: {
      logFormat: 'text',
      logLevel: debug ? 'debug' : 'error',
    },
  })
}
