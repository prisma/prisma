import { HIDDEN_CLIENT } from '../types/Extensions'

export function getExtensionClient<T>(that: T) {
  return that as T[keyof T & typeof HIDDEN_CLIENT] & {}
}
