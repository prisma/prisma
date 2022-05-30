import type { InternalDatasource } from '../../runtime/utils/printDatasources'

type LoadedEnv = {
  parsed: {
    [x: string]: string | undefined
  }
}

/**
 * Builds an injectable environment for the data proxy edge client. It's useful
 * because it is designed to run in browser-like environments where things like
 * `fs`, `process.env`, and .env file loading are not available. The injectable
 * env is the default fallback when `tryLoadEnvs` wasn't called by the client.
 * @see {@link declareInjectableEdgeEnv}
 * @param edge
 * @param datasources
 * @returns
 */
export function buildInjectableEdgeEnv(edge: boolean | undefined, datasources: InternalDatasource[]) {
  if (edge === true) {
    const envVarNames = getSelectedEnvVarNames(datasources)
    const loadedEnv = getEmptyEnvObjectForVars(envVarNames)

    return declareInjectableEdgeEnv(loadedEnv)
  }

  return ``
}

/**
 * Determines which env vars we are interested in in the case of the data proxy
 * client. Right now, we are only interested in env vars from the `datasource`.
 * @param datasources to find env vars in
 * @returns
 */
function getSelectedEnvVarNames(datasources: InternalDatasource[]) {
  return datasources.reduce((acc, datasource) => {
    if (datasource.url.fromEnvVar) {
      return [...acc, datasource.url.fromEnvVar]
    }

    return acc
  }, [] as string[])
}

/**
 * Like `tryLoadEnvs` but we only retain a subset of the env vars that will be
 * used in the case of the data proxy client. And we discard the `message` prop.
 * @param envVarNames to be selected from the load
 * @returns
 */
function getEmptyEnvObjectForVars(envVarNames: string[]) {
  const selectedEnv: LoadedEnv = { parsed: {} }

  for (const envVarName of envVarNames) {
    /** note that we willingly keep `undefined` values because
     * we need that later in {@link declareInjectableEdgeEnv} **/
    selectedEnv.parsed[envVarName] = undefined
  }

  return selectedEnv
}

/**
 * Creates the necessary declarations to embed env vars directly inside of the
 * generated client. We abuse a custom `JSON.stringify` replacer to transform
 * {@link loadedEnv} into a piece of code. The goal of this is to take that and
 * generate a new object which re-prioritizes the loading of the environment.
 *
 * By generating an output with `${key} || process.env.${key} || '${value}'` it
 * would yield something like `DB_URL || process.env.DB_URL || undefined`:
 * - For Cloudflare Workers `DB_URL` will be the first to be found (runtime)
 *   - `process.env.DB_URL` will be undefined
 * - For Vercel `process.env.DB_URL` is replaced by webpack by a value
 *   - `DB_URL` will be undefined at anytime
 * - If none of them were provided, we fallback to the default `undefined`
 * @param loadedEnv
 */
function declareInjectableEdgeEnv(loadedEnv: LoadedEnv) {
  // abuse a custom replacer to create the injectable env
  const injectableEdgeEnvDeclaration = JSON.stringify(
    loadedEnv,
    (key, value) => {
      if (key === '') return value
      if (key === 'parsed') return value

      const cfwEnv = `typeof global !== 'undefined' && global['${key}']`
      const vercelEnv = `process.env['${key}']`
      const dotEnv = value ? `'${value}'` : 'undefined'

      return `${cfwEnv} || ${vercelEnv} || ${dotEnv}`
    },
    2,
  ).replace(/"/g, '') // remove quotes to make code

  return `
config.injectableEdgeEnv = ${injectableEdgeEnvDeclaration}`
}
