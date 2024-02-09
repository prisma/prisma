import { Providers } from '../_utils/providers'

export const providersSupportingRelationJoins = [Providers.POSTGRESQL, Providers.COCKROACHDB, Providers.MYSQL]

/**
 * Generic relation load strategy.
 * The generated type for a specific provider may be narrower.
 */
export type RelationLoadStrategy = 'query' | 'join'
