import { DataSource } from '@prisma/generator-helper'

import { TSClientOptions } from '../TSClient/TSClient'

// that is all we need for the data proxy
export type InlineDatasources = {
  [name in DataSource['name']]: {
    url: DataSource['url']
  }
}

/**
 * Builds the important datasource information for the data proxy. Essentially,
 * it saves the URL or env var name for the data proxy engine to read later.
 * @param dataProxy
 * @param datasources
 * @returns
 */
export function buildInlineDatasource({ dataProxy, datasources }: TSClientOptions) {
  if (dataProxy === true) {
    const inlineDataSources = dataSourcesToInlineDataSources(datasources)

    return `
config.inlineDatasources = ${JSON.stringify(inlineDataSources, null, 2)}`
  }

  return ``
}

/**
 * Transforms an array of datasources into an inline datasources
 * @param datasources
 * @returns
 */
function dataSourcesToInlineDataSources(datasources: DataSource[]) {
  return datasources.reduce((acc, ds) => {
    acc[ds.name] = { url: ds.url }

    return acc
  }, {} as InlineDatasources)
}
