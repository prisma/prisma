import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation'

import { GLOBAL_KEY, MODULE_NAME, NAME, VERSION } from './constants'

export interface PrismaInstrumentationConfig {}

export class PrismaInstrumentation extends InstrumentationBase {
  constructor(config: PrismaInstrumentationConfig = {}) {
    super(NAME, VERSION, config)
  }

  init() {
    const module = new InstrumentationNodeModuleDefinition(MODULE_NAME, [VERSION])

    return [module]
  }

  enable() {
    // @ts-ignore
    global[GLOBAL_KEY] = true
  }

  disable() {
    // @ts-ignore
    delete global[GLOBAL_KEY]
  }

  isEnabled() {
    return Boolean(global[GLOBAL_KEY])
  }
}
