import type { O } from 'ts-toolbelt'

import type { AdapterProviders, Providers } from '../providers'

type RelationMode = 'prisma' | 'foreignKeys'

type Target = {
  provider: `${Providers}`
  driverAdapter?: `${AdapterProviders}`
  relationMode: `${RelationMode}`
}

type ConditionalErrorSnapshotErrors = O.AtLeast<Record<AdapterProviders | Providers, string>> | string

interface With<Supplied> {
  with<T extends Omit<Target, keyof Supplied>, K extends keyof T>(
    key: K,
    value: T[K],
  ): keyof Omit<Omit<Target, keyof Supplied>, K> extends never ? ConditionalErrorSnapshot : With<Supplied & Pick<T, K>>
}

interface ConditionalErrorSnapshot {
  snapshot(errors: O.AtLeast<Record<RelationMode, ConditionalErrorSnapshotErrors>>): string
}

class ConditionalErrorBuilder<Supplied> implements With<Supplied>, ConditionalErrorSnapshot {
  constructor(private target: Partial<Target>) {}

  with<T extends Omit<Target, keyof Supplied>, K extends keyof T>(key: K, value: T[K]) {
    const target: Partial<Target> = { ...this.target, [key]: value }
    return new ConditionalErrorBuilder<Supplied & Pick<T, K>>(target)
  }

  snapshot(errors: O.AtLeast<Record<RelationMode, ConditionalErrorSnapshotErrors>>) {
    const { provider, driverAdapter, relationMode } = this.target as Target
    const errorBase = errors[relationMode]

    if (typeof errorBase === 'string') {
      return errorBase
    }

    if (errorBase === undefined) {
      return `TODO: add error for relationMode=${relationMode}`
    }

    // The errors are exactly the same for SQLite and these driverAdapters
    if (driverAdapter === 'js_d1' || driverAdapter === 'js_libsql') {
      return (
        errorBase.sqlite ||
        'TODO: add error for provider=sqlite (which will be used for libSQL and D1 driver adapters snapshots)'
      )
    }

    return (
      errorBase[driverAdapter ?? provider] ||
      `TODO: add error for provider=${provider} and driverAdapter=${driverAdapter}`
    )
  }
}

/**
 * Example usage:
 *
 * const conditionalError = ConditionalError
 *   .new()
 *   .with('provider', Providers.MYSQL)
 *   .with('driverAdapter', AdapterProviders.VITESS_8)
 *   .with('relationMode', 'prisma')
 *
 * conditionalError.snapshot({
 *   foreignKeys: 'TODO add error with relationMode=foreignKeys',
 *   prisma: {
 *     [AdapterProviders.VITESS_8]: 'TODO add error for provider=mysql and driverAdapter=vitess-8',
 *   }
 * })
 */
export class ConditionalError {
  static new(): With<{}> {
    return new ConditionalErrorBuilder<{}>({})
  }
}
