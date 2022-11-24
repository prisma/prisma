import { CompositeProxyLayer } from './createCompositeProxy'

export function removeProperties(keys: (string | symbol)[]): CompositeProxyLayer {
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
