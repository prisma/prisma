// Taken from https://gist.github.com/LukeChannings/15c92cef5a016a8b21a0

// ensure the keys being passed is an array of key paths
// example: 'a.b' becomes ['a', 'b'] unless it was already ['a', 'b']
const keys = (ks: string | string[]) => (Array.isArray(ks) ? ks : ks.split('.'))

// traverse the set of keys left to right,
// returning the current value in each iteration.
// if at any point the value for the current key does not exist,
// return the default value
export const deepGet = (o, kp: string[]) => keys(kp).reduce((o, k) => o?.[k], o)

// traverse the set of keys right to left,
// returning a new object containing both properties from the object
// we were originally passed and our new property.
//
// Example:
// If o = { a: { b: { c: 1 } } }
//
// deepSet(o, ['a', 'b', 'c'], 2) will progress thus:
// 1. c = Object.assign({}, {c: 1}, { c: 2 })
// 2. b = Object.assign({}, { b: { c: 1 } }, { b: c })
// 3. returned = Object.assign({}, { a: { b: { c: 1 } } }, { a: b })
export const deepSet = (o: any, kp: string | string[], v: any) =>
  keys(kp).reduceRight((v, k, i, ks) => Object.assign({}, deepGet(o, ks.slice(0, i)), { [k]: v }), v)
