/* eslint-disable no-var */

export type TracingConfig = { enabled: boolean; middleware: boolean }

declare global {
  var PRISMA_INSTRUMENTATION: PrismaInstrumentationConfig | undefined
}

export interface PrismaInstrumentationConfig {
  middleware?: boolean
}

export function getTracingConfig(previewFeatures: string[]) {
  const tracingConfig = {} as TracingConfig

  if (previewFeatures.includes('tracing') && globalThis.PRISMA_INSTRUMENTATION) {
    tracingConfig.enabled = true
    tracingConfig.middleware = !!globalThis.PRISMA_INSTRUMENTATION.middleware

    return tracingConfig
  }

  return { enabled: false, middleware: false }
}
