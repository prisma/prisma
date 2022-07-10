import { Engine } from '../Engine'

export type TracingConfig = { enabled: Boolean }

export function getTracingConfig(engine: Engine) {
  const result: TracingConfig = {
    enabled: false,
  }

  const hasPreview = engine._hasPreviewFlag('tracing')
  // TODO - this could be a symbol - It dont seem safe!
  const globalVar = global.PRISMA_INSTRUMENTATION

  if (hasPreview && globalVar) {
    result.enabled = true
  }

  return result
}
