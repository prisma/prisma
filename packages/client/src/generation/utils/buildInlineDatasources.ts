import type { InternalDatasource } from '../../runtime/utils/printDatasources'

// that is all we need for the data proxy
export type InlineDatasources = {
  [name in InternalDatasource['name']]: {
    url: InternalDatasource['url']
  }
}

/**
 * Builds the important datasource information for the data proxy. Essentially,
 * it saves the URL or env var name for the data proxy engine to read later.
 * @param engineType
 * @param internalDatasources
 * @returns
 */
export function buildInlineDatasource(dataProxy: boolean, internalDatasources: InternalDatasource[]) {
  if (dataProxy === true) {
    const datasources = internalToInlineDatasources(internalDatasources)

    return `
config.inlineDatasources = ${JSON.stringify(datasources, null, 2)}`
  }

  return ``
}

/**
 * Transforms an array of datasources into an inline datasources
 * @param internalDatasources
 * @returns
 */
function internalToInlineDatasources(internalDatasources: InternalDatasource[]) {
  return internalDatasources.reduce((acc, ds) => {
    acc[ds.name] = { url: ds.url }

    return acc
  }, {} as InlineDatasources)
}
