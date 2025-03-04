import type { CompositeProxyLayer } from './createCompositeProxy'

export function removeProperties(keys: ReadonlyArray<string | symbol>): CompositeProxyLayer {
  return {
    getKeys() {
      return keys
    },

    has() {
      return false
    },

    getPropertyValue() {
      return undefined
    },
  }
}
