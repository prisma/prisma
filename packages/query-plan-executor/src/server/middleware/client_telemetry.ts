import { Middleware } from '@oak/oak/middleware'
import { Context, Status } from '@oak/oak'

import { State } from '../state.ts'
import { LogLevel, parseLogLevel } from '../../log/log_level.ts'
import * as log from '../../log/facade.ts'
import { extractErrorFromUnknown } from '../../utils/error.ts'
import { TracingCollector, tracingCollectorContext } from '../../tracing/collector.ts'
import { Logger } from '../../log/logger.ts'
import { getActiveLogger, withActiveLogger } from '../../log/context.ts'
import { CapturingSink, CompositeSink, FilteringSink } from '../../log/sink.ts'
import { discreteLogFilter } from '../../log/filter.ts'

/**
 * Middleware that handles the `X-Capture-Telemetry` header,
 * captures telemetry data based on the header settings and
 * injects the `logs` and `spans` properties to the response.
 */
export const clientTelemetryMiddleware: Middleware<State> = async (ctx, next) => {
  const captureTelemetryHeader = ctx.request.headers.get('x-capture-telemetry')

  if (captureTelemetryHeader === null) {
    await next()
    return
  }

  const captureSettings = parseClientTelemetryHeaderOrThrowBadRequest(ctx, captureTelemetryHeader)

  const spanCollector = TracingCollector.newInCurrentContext()
  const logCollector = new CapturingSink()

  const logger = new Logger(
    new CompositeSink(
      getActiveLogger().sink,
      new FilteringSink(logCollector, discreteLogFilter(captureSettings.logLevels)),
    ),
  )

  await tracingCollectorContext.withActive(spanCollector, async () => {
    await withActiveLogger(logger, async () => {
      await next()
    })
  })

  const jsonResponse = tryGetJsonResponse(ctx)

  if (jsonResponse !== undefined) {
    if (captureSettings.logLevels.length > 0) {
      jsonResponse.logs = logCollector.export()
    }

    if (captureSettings.spans) {
      jsonResponse.spans = spanCollector.spans
    }
  }
}

export type CaptureSettings = {
  spans: boolean
  logLevels: LogLevel[]
}

export function parseClientTelemetryHeader(header: string): CaptureSettings {
  const result: CaptureSettings = {
    spans: false,
    logLevels: [],
  }

  for (const level of header.split(',')) {
    const trimmedLevel = level.trim()

    if (trimmedLevel === '') continue

    if (trimmedLevel === 'spans') {
      result.spans = true
      continue
    }

    result.logLevels.push(parseLogLevel(trimmedLevel))
  }

  return result
}

function parseClientTelemetryHeaderOrThrowBadRequest(ctx: Context, header: string): CaptureSettings {
  try {
    return parseClientTelemetryHeader(header)
  } catch (error) {
    log.error('Failed to parse client telemetry header', {
      error: extractErrorFromUnknown(error),
    })
    ctx.throw(Status.BadRequest, 'Malformed X-Capture-Telemetry header')
  }
}

function tryGetJsonResponse(ctx: Context): Record<PropertyKey, unknown> | undefined {
  const body = ctx.response.body

  if (typeof body === 'object' && body !== null) {
    return body as Record<PropertyKey, unknown>
  }

  log.error("Telemetry can't be injected into non-JSON response", {
    method: ctx.request.method,
    pathname: ctx.request.url.pathname,
  })

  return undefined
}
