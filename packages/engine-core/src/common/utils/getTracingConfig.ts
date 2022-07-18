import { Engine } from '../Engine'

export type TracingConfig = { enabled: Boolean; middleware?: boolean }

export interface PrismaInstrumentationConfig {
  middleware?: boolean
}

export function getTracingConfig(engine: Engine) {
  const hasPreview = engine._hasPreviewFlag('tracing')
  const globalVar = global.PRISMA_INSTRUMENTATION as undefined | PrismaInstrumentationConfig

  const result: TracingConfig = {
    enabled: false,
  }

  if (hasPreview && globalVar) {
    result.enabled = true
    result.middleware = globalVar.middleware
  }

  return result
}
