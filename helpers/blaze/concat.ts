import { L } from 'ts-toolbelt'

/**
 * Combines two lists into a new one.
 *
 * (more efficient than native concat)
 * @param list0
 * @param list1
 * @returns
 */
function concat<I0, I1>(list0: L.List<I0>, list1: L.List<I1>) {
  let length = list0.length + list1.length

  // tipping point where implementation becomes slower
  if (length > 200) return list0.concat(list1 as any)

  const _list: (I0 | I1)[] = new Array(length)

  for (let j = list1.length - 1; j >= 0; --j) {
    _list[--length] = list1[j]
  }

  for (let j = list0.length - 1; j >= 0; --j) {
    _list[--length] = list0[j]
  }

  return _list
}

export { concat }
