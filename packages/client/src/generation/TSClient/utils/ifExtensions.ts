import { TSClient } from '../TSClient'

export function ifExtensions<R>(_case: R | (() => R), _default: R | (() => R)): R {
  if (TSClient.enabledPreviewFeatures.includes('clientExtensions')) {
    return typeof _case === 'function' ? (_case as any)() : _case
  }

  return typeof _default === 'function' ? (_default as any)() : _default
}
