/* eslint-disable no-var */

export type TracingConfig = { enabled: boolean; middleware: boolean }

declare global {
  var PRISMA_INSTRUMENTATION: PrismaInstrumentationConfig | undefined
}

export interface PrismaInstrumentationConfig {
  middleware?: boolean
}

/**
 * The Global var PRISMA_INSTRUMENTATION can be turned on and off via the
 * `enable` method on {@link PrismaInstrumentation} class so we use getters to
 * always get the 'real value' that is up-to-date.
 * @param previewFeatures
 * @returns
 */
export function getTracingConfig(previewFeatures: string[]): TracingConfig {
  const hasTracingPreviewFeatureFlagEnabled = previewFeatures.includes('tracing')

  return {
    get enabled() {
      return Boolean(globalThis.PRISMA_INSTRUMENTATION && hasTracingPreviewFeatureFlagEnabled)
    },
    get middleware() {
      return Boolean(globalThis.PRISMA_INSTRUMENTATION && globalThis.PRISMA_INSTRUMENTATION.middleware)
    },
  }
}
