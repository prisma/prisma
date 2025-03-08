import { trace, type TracerProvider } from '@opentelemetry/api'
import {
  InstrumentationBase,
  type InstrumentationConfig,
  InstrumentationNodeModuleDefinition,
} from '@opentelemetry/instrumentation'
import type { PrismaInstrumentationGlobalValue } from '@prisma/internals'

import { ActiveTracingHelper } from './ActiveTracingHelper'
import {
  GLOBAL_INSTRUMENTATION_ACCESSOR_KEY,
  GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY,
  MODULE_NAME,
  NAME,
  VERSION,
} from './constants'

export interface PrismaInstrumentationConfig {
  middleware?: boolean
}

type Config = PrismaInstrumentationConfig & InstrumentationConfig

export class PrismaInstrumentation extends InstrumentationBase {
  private tracerProvider: TracerProvider | undefined

  constructor(config: Config = {}) {
    super(NAME, VERSION, config)
  }

  setTracerProvider(tracerProvider: TracerProvider): void {
    this.tracerProvider = tracerProvider
  }

  init() {
    const module = new InstrumentationNodeModuleDefinition(MODULE_NAME, [VERSION])

    return [module]
  }

  enable() {
    const config = this._config as Config

    const globalValue: PrismaInstrumentationGlobalValue = {
      helper: new ActiveTracingHelper({
        traceMiddleware: config.middleware ?? false,
        tracerProvider: this.tracerProvider ?? trace.getTracerProvider(),
      }),
    }

    // TODO(v7): Future major versions should only write to the GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY, to prevent version incompatibilities with instrumentation libraries to cause errors when the `TracingHelper` interface is changed.
    global[GLOBAL_INSTRUMENTATION_ACCESSOR_KEY] = globalValue
    global[GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY] = globalValue
  }

  disable() {
    delete global[GLOBAL_INSTRUMENTATION_ACCESSOR_KEY]
    delete global[GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY]
  }

  isEnabled() {
    return Boolean(global[GLOBAL_VERSIONED_INSTRUMENTATION_ACCESSOR_KEY])
  }
}
