import { TSClientOptions } from '../TSClient/TSClient'
import { getRuntimeEdgeEnvVar } from './buildInjectableEdgeEnv'

/**
 * Builds the code to initialize the `debug` package.
 *
 * The code running in the Edge Client entry point has access to `process.env`
 * if it's defined, but the code in the runtime bundle doesn't. Furthermore, in
 * some environments `DEBUG` may be defined as a global variable rather than
 * available in `process.env`. The entry point fetches the value of `DEBUG` and
 * passes into the `debug` package.
 *
 * @param flavor Whether the edge runtime is used
 */
export function buildDebugInitialization({ edge }: TSClientOptions) {
  if (edge === false) {
    return ''
  }

  const debugVar = getRuntimeEdgeEnvVar('DEBUG')

  return `\
if (${debugVar}) {
  Debug.enable(${debugVar})
}
`
}
