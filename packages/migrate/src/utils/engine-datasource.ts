import type { Datasource } from '@prisma/config'

/**
 * The datasource payload the schema engine is started with: the configured datasource plus the
 * consent to reset a shadow database that is not empty.
 *
 * Consent is not part of {@link Datasource} itself: it is given per invocation, by a flag or by
 * answering a prompt, and a Prisma config file must not be able to grant it once and for all.
 */
export type EngineDatasource = Datasource & {
  resetShadowDatabase?: boolean
}

/**
 * Builds the payload from the configured datasource and the consent given for this invocation.
 * Consent that was not given is left out of the payload entirely, which is what the engine reads
 * as "no consent".
 */
export function engineDatasource(
  datasource: Datasource | undefined,
  resetShadowDatabase: boolean | undefined,
): EngineDatasource | undefined {
  if (!resetShadowDatabase) {
    return datasource
  }

  return { ...datasource, resetShadowDatabase: true }
}
