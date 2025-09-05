export interface QueryPlanExecutorExtension {
  /**
   * A regular expression that matches the routes that need to be proxied to the
   * query plan executor server.
   */
  routes: RegExp

  /**
   * The compatible Prisma Client version.
   */
  allowedClientVersion: string

  /**
   * Returns a query plan executor server for the given options.
   *
   * This method should return the same instance given identical options.
   */
  getServer(options: GetQueryPlanExecutorServerOptions): Promise<QueryPlanExecutorServer>
}

export interface GetQueryPlanExecutorServerOptions {
  connectionString: string
  debug: boolean
}

export interface QueryPlanExecutorServer {
  fetch(request: Request): Response | Promise<Response>
}
