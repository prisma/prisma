import { HIDDEN_MODEL } from '../types/Extensions'

export function getExtensionModel<T>(that: T) {
  return that as T[keyof T & typeof HIDDEN_MODEL] & {}
}
