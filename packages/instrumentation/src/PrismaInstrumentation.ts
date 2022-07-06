import { InstrumentationBase, InstrumentationNodeModuleDefinition } from '@opentelemetry/instrumentation'

const VERSION = 'TODO'

export interface PrismaInstrumentationConfig {}

export const module = new InstrumentationNodeModuleDefinition('express', [VERSION])

export class PrismaInstrumentation extends InstrumentationBase {
  constructor(config: PrismaInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-express', VERSION, Object.assign({}, config))
  }

  init() {
    // @ts-ignore - TODO what should this be? Global symbol ? How to type it ? How to test it? What about options?
    global.HAS_CONSTRUCTED_INSTRUMENTATION = true

    return [module]
  }
}
