import { Middleware } from '@oak/oak/middleware'

import * as log from '../../log/facade.ts'

export const logMiddleware: Middleware = async (ctx, next) => {
  const id = crypto.randomUUID()

  log.debug('Request', {
    id,
    method: ctx.request.method,
    pathname: ctx.request.url.pathname,
  })

  await next()

  log.debug('Response', {
    id,
    status: ctx.response.status,
    method: ctx.request.method,
    pathname: ctx.request.url.pathname,
  })
}
