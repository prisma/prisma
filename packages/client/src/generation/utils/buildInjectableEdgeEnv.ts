import type { InternalDatasource } from '../../runtime/utils/printDatasources'

type InjectableEnv = {
  parsed: {
    [x: string]: string | undefined
  }
}

/**
 * Builds an injectable environment for the data proxy edge client. It's useful
 * because it is designed to run in browser-like environments where things like
 * `fs`, `process.env`, and .env file loading are not available. It is the place
 * where we make collect the env vars for the edge client. To understand this
 * better, take a look at the generated code in the edge client.
 * @see {@link declareInjectableEdgeEnv}
 * @param edge
 * @param datasources
 * @returns
 */
export function buildInjectableEdgeEnv(edge: boolean, datasources: InternalDatasource[]) {
  if (edge === true) {
    return declareInjectableEdgeEnv(datasources)
  }

  return ``
}

/**
 * Creates the necessary declarations to embed env vars directly inside of the
 * generated client. We abuse a custom `JSON.stringify` to generate the code.
 * @param datasources to find env vars in
 */
function declareInjectableEdgeEnv(datasources: InternalDatasource[]) {
  const envVarNames = getSelectedEnvVarNames(datasources)

  const injectableEdgeEnv: InjectableEnv = { parsed: {} }

  // we create a base env with empty values for env names
  for (const envVarName of envVarNames) {
    injectableEdgeEnv.parsed[envVarName] = undefined
  }

  // abuse a custom replacer to create the injectable env
  const injectableEdgeEnvDeclaration = JSON.stringify(
    injectableEdgeEnv,
    (key, value) => {
      if (key === '') return value
      if (key === 'parsed') return value

      // for cloudflare workers, an env var is a global js variable
      const cfwEnv = `typeof global !== 'undefined' && global['${key}']`
      // for vercel edge functions, it's injected statically at build
      const vercelEnv = `process.env.${key}`

      return `${cfwEnv} || ${vercelEnv} || undefined`
    },
    2,
  ).replace(/"/g, '') // remove quotes to make code

  return `
config.injectableEdgeEnv = ${injectableEdgeEnvDeclaration}`
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
