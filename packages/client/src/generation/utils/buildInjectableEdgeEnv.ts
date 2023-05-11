import { DataSource } from '@prisma/generator-helper'

import { TSClientOptions } from '../TSClient/TSClient'

type InjectableEnv = {
  parsed: {
    [x: string]: string | undefined
  }
}

/**
 * Builds an injectable environment for the data proxy edge client. It's useful
 * because it is designed to run in browser-like environments where things like
 * `fs`, `process.env`, and .env file loading are not available. That means env
 * vars are represented as a global variable or injected at build time. This is
 * the glue code to make this work with our existing env var loading logic. It
 * is the place where we make collect the env vars for the edge client. To
 * understand this better, take a look at the generated code in the edge client.
 * @see {@link declareInjectableEdgeEnv}
 * @param edge
 * @param datasources
 * @returns
 */
export function buildInjectableEdgeEnv({ edge, datasources }: TSClientOptions) {
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
function declareInjectableEdgeEnv(datasources: DataSource[]) {
  // we create a base env with empty values for env names
  const injectableEdgeEnv: InjectableEnv = { parsed: {} }
  const envVarNames = getSelectedEnvVarNames(datasources)

  for (const envVarName of envVarNames) {
    injectableEdgeEnv.parsed[envVarName] = getRuntimeEdgeEnvVar(envVarName)
  }

  // we make it json then remove the quotes to turn it into "code"
  const injectableEdgeEnvJson = JSON.stringify(injectableEdgeEnv, null, 2)
  const injectableEdgeEnvCode = injectableEdgeEnvJson.replace(/"/g, '')

  return `
config.injectableEdgeEnv = ${injectableEdgeEnvCode}`
}

/**
 * Determines which env vars we are interested in in the case of the data proxy
 * client. Right now, we are only interested in env vars from the `datasource`.
 * @param datasources to find env vars in
 * @returns
 */
function getSelectedEnvVarNames(datasources: DataSource[]) {
  return datasources.reduce((acc, datasource) => {
    if (datasource.url.fromEnvVar) {
      return [...acc, datasource.url.fromEnvVar]
    }

    return acc
  }, [] as string[])
}

/**
 * Builds the expression to get the value of an environment variable at run time.
 * @param envVarName Name of the environment variable
 */
export function getRuntimeEdgeEnvVar(envVarName: string) {
  // for cloudflare workers, an env var is a global js variable
  const cfwEnv = `typeof globalThis !== 'undefined' && globalThis['${envVarName}']`
  // for vercel edge functions, it's injected statically at build
  const nodeOrVercelEnv = `typeof process !== 'undefined' && process.env && process.env.${envVarName}`

  return `${cfwEnv} || ${nodeOrVercelEnv} || undefined`
}
