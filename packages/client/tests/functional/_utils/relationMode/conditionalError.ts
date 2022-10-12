import { O } from 'ts-toolbelt'

import { Providers } from '../providers'

type RelationMode = 'prisma' | 'foreignKeys'

type Target = {
  provider: Providers
  relationMode: RelationMode
}

// O.AtLeast<Record<Providers, string>>
type ConditionalErrorSnapshotErrors = O.AtLeast<Record<Providers, string>> | string

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
    const { provider, relationMode } = this.target as Target
    const errorBase = errors[relationMode]

    if (typeof errorBase === 'string') {
      return errorBase
    }

    if (errorBase === undefined) {
      return `TODO: add error for relationMode=${relationMode}`
    }

    return errorBase[provider] || `TODO: add error for provider=${provider}`
  }
}

/**
 * Example usage:
 *
 * const conditionalError  = ConditionalError
 *   .new()
 *   .with('provider', Providers.POSTGRESQL)
 *   .with('relationMode', 'prisma')
 *
 * conditionalError.snapshot({
 *   prisma: 'TODO add error with relationMode = prisma',
 *   foreignKeys: {
 *     [Providers.POSTGRESQL]: 'TODO add error for POSTGRESQL with relationMode = foreignKeys',
 *   }
 * })
 */
export class ConditionalError {
  static new(): With<{}> {
    return new ConditionalErrorBuilder<{}>({})
  }
}
