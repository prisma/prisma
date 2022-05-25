import type { EnvPaths } from '@prisma/sdk'
import { tryLoadEnvs } from '@prisma/sdk'

import type { InternalDatasource } from '../../runtime/utils/printDatasources'

type LoadedEnv = {
  parsed: {
    [x: string]: string | undefined
  }
}

/**
 * Builds an inline environment for the data proxy client. This is useful
 * because it is designed to run in browser-like environments where things like
 * `fs`, `process.env`, and .env file loading are not available. The inline env
 * is the default fallback when `tryLoadEnvs` wasn't called by the client.
 * @see {@link declareInlineEnv}
 * @param clientEngineType
 * @param datasources
 * @param envPaths
 * @returns
 */
export function buildInlineEnv(dataProxy: boolean, datasources: InternalDatasource[], envPaths: EnvPaths) {
  if (dataProxy === true) {
    const envVarNames = getSelectedEnvVarNames(datasources)
    const loadedEnv = loadSelectedEnvVars(envPaths, envVarNames)

    return declareInlineEnv(loadedEnv)
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
 * @param envPaths to load the .env files from
 * @param envVarNames to be selected from the load
 * @returns
 */
function loadSelectedEnvVars(envPaths: EnvPaths, envVarNames: string[]) {
  const loadedEnv = tryLoadEnvs(envPaths, { conflictCheck: 'warn' })
  const selectedEnv: LoadedEnv = { parsed: {} }

  for (const envVarName of envVarNames) {
    const loadedEnvVar = loadedEnv?.parsed[envVarName]

    // note that we willingly keep `undefined` values
    // because we need that later in `declareInlineEnv`
    selectedEnv.parsed[envVarName] = loadedEnvVar
  }

  return selectedEnv
}

/**
 * Creates the necessary declarations to embed env vars directly inside of the
 * generated client. We abuse a custom `JSON.stringify` replacer to transform
 * {@link loadedEnv } into a piece of code. The goal of this is to take that and
 * generate a new object which re-prioritizes the loading of the environment.
 *
 * By generating an output with `${key} || process.env.${key} || '${value}'` it
 * would yield something like `DB_URL || process.env.DB_URL || 'prisma://...'`:
 * - For Cloudflare Workers `DB_URL` will be the first to be found (runtime)
 *   - `process.env.DB_URL` will be undefined
 * - For Vercel `process.env.DB_URL` is replaced by webpack by a value
 *   - `DB_URL` will be undefined at anytime
 * - If none of them were provided, we fallback to the one of the .env file
 *   - If empty, the value will be `undefined`
 *
 * As per the current standard, env vars have priority over any .env files.
 * @param loadedEnv
 */
function declareInlineEnv(loadedEnv: LoadedEnv) {
  // abuse a custom replacer to create the inline env
  const inlineEnvDeclaration = JSON.stringify(
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
config.inlineEnv = ${inlineEnvDeclaration}`
}
