import { Context, RouteParams, Router, RouterContext, Status } from '@oak/oak'
import { QueryPlanNode, TransactionManagerError, UserFacingError } from '@prisma/client-engine-runtime'

import { State } from './state.ts'
import { parseResourceLimitsFromHeadersWithDefaults } from './headers.ts'
import {
  ConnectionInfoResponseBody,
  parseRequestBody,
  QueryRequestBody,
  QueryResponseBody,
  TransactionEndResponseBody,
  TransactionStartRequestBody,
  TransactionStartResponseBody,
} from './schemas.ts'
import { ResourceLimitError } from '../logic/resource_limits.ts'

export const router = new Router<State>()

router
  .get('/health', (ctx) => {
    ctx.response.body = { status: 'ok' }
  })
  .get('/connection-info', (ctx) => {
    ctx.response.body = ctx.state.app.getConnectionInfo() satisfies ConnectionInfoResponseBody
  })
  .post('/query', queryHandler)
  .post('/transaction/start', async (ctx) => {
    const resourceLimits = parseResourceLimitsFromHeadersWithDefaults(ctx, ctx.state.options)

    const txOptions = await parseRequestBody(TransactionStartRequestBody, ctx)

    try {
      const result = await ctx.state.app.startTransaction(txOptions, resourceLimits)

      ctx.response.headers.set('Prisma-Transaction-ID', result.id)
      ctx.response.body = result satisfies TransactionStartResponseBody
    } catch (error) {
      handleAppError(error, ctx)
    }
  })
  .post('/transaction/:txId/query', queryHandler)
  .post('/transaction/:txId/commit', async (ctx) => {
    const transactionId = ctx.params.txId

    try {
      await ctx.state.app.commitTransaction(transactionId)

      ctx.response.body = {} satisfies TransactionEndResponseBody
    } catch (error) {
      handleAppError(error, ctx)
    }
  })
  .post('/transaction/:txId/rollback', async (ctx) => {
    const transactionId = ctx.params.txId

    try {
      await ctx.state.app.rollbackTransaction(transactionId)

      ctx.response.body = {} satisfies TransactionEndResponseBody
    } catch (error) {
      handleAppError(error, ctx)
    }
  })

async function queryHandler<R extends string | `${string}/:txId/${string}`>(
  ctx: RouterContext<R, RouteParams<R>, State>,
) {
  const resourceLimits = parseResourceLimitsFromHeadersWithDefaults(ctx, ctx.state.options)

  const request = await parseRequestBody(QueryRequestBody, ctx)

  try {
    const result = await ctx.state.app.query(
      request.plan as QueryPlanNode,
      request.params,
      resourceLimits,
      ctx.params.txId ?? null,
    )

    ctx.response.body = { data: result } satisfies QueryResponseBody
  } catch (error) {
    handleAppError(error, ctx)
  }
}

function handleAppError(error: unknown, ctx: Context) {
  if (error instanceof ResourceLimitError) {
    ctx.response.status = Status.UnprocessableEntity
    ctx.response.body = { error: error.message } satisfies QueryResponseBody
  } else if (error instanceof TransactionManagerError) {
    ctx.response.status = Status.Conflict
    ctx.response.body = { error: error.message } satisfies QueryResponseBody
  } else if (error instanceof UserFacingError) {
    ctx.response.status = Status.BadRequest
    ctx.response.body = {
      code: error.code,
      error: error.message,
      meta: error.meta,
    } satisfies QueryResponseBody
  } else {
    ctx.response.status = Status.InternalServerError
    ctx.response.body = {
      error: String(error),
    } satisfies QueryResponseBody
  }
}
