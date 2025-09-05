import { Application } from '@oak/oak/application'

import * as log from '../log/facade.ts'
import { Options } from '../options.ts'
import { connect, State } from './state.ts'
import { router } from './router.ts'
import { logMiddleware } from './middleware/log.ts'
import { extractErrorFromUnknown } from '../utils/error.ts'
import { clientTelemetryMiddleware } from './middleware/client_telemetry.ts'

/**
 * Starts the HTTP server that handles query plan execution requests.
 */
export async function startServer(options: Options) {
  const { host, port } = options

  const app = new Application<State>({
    state: await connect(options),
    contextState: 'alias',
  })

  app.addEventListener('error', (event) => {
    log.error(`Server error`, { error: extractErrorFromUnknown(event.error) })
  })

  app.addEventListener('listen', () => {
    log.info(`Server listening on ${host}:${port}`, { host, port })
  })

  app.use(logMiddleware)
  app.use(clientTelemetryMiddleware)

  app.use(router.routes())
  app.use(router.allowedMethods())

  await app.listen({ hostname: host, port })
}
