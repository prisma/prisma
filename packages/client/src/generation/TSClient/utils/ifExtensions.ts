export function ifExtensions<R>(_case: R | (() => R), _default: R | (() => R)): R {
  return typeof _case === 'function' ? (_case as any)() : _case

  // return typeof _default === 'function' ? (_default as any)() : _default
}
