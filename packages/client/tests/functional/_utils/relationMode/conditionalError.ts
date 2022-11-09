import { O } from 'ts-toolbelt'

import { Providers } from '../providers'
import { ProviderFlavor } from './ProviderFlavor'

type RelationMode = 'prisma' | 'foreignKeys'

type Target = {
  provider: Providers
  providerFlavor: ProviderFlavor
  relationMode: RelationMode
}

type ConditionalErrorSnapshotErrors = O.AtLeast<Record<ProviderFlavor, string>> | string

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
    const { provider, providerFlavor, relationMode } = this.target as Target
    const errorBase = errors[relationMode]

    if (typeof errorBase === 'string') {
      return errorBase
    }

    if (errorBase === undefined) {
      return `TODO: add error for relationMode=${relationMode}`
    }

    return errorBase[providerFlavor] || `TODO: add error for provider=${provider} and providerFlavor=${providerFlavor}`
  }
}

/**
 * Example usage:
 *
 * const conditionalError = ConditionalError
 *   .new()
 *   .with('provider', Providers.MYSQL)
 *   .with('providerFlavor', ProviderFlavors.VITESS_8)
 *   .with('relationMode', 'prisma')
 *
 * conditionalError.snapshot({
 *   foreignKeys: 'TODO add error with relationMode=foreignKeys',
 *   prisma: {
 *     [ProviderFlavors.VITESS_8]: 'TODO add error for provider=mysql and providerFlavor=vitess-8',
 *   }
 * })
 */
export class ConditionalError {
  static new(): With<{}> {
    return new ConditionalErrorBuilder<{}>({})
  }
}
