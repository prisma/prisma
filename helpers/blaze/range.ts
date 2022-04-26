/* eslint-disable @typescript-eslint/no-unsafe-argument */

function _range(from: number, to: number): number[] {
  const length = Math.abs(from - to)
  const range = new Array(length)

  if (from === to) return [from]
  for (let i = 0, _from = from; _from >= to; i++) range[i] = _from--
  for (let i = 0, _from = from; _from <= to; i++) range[i] = _from++

  return range
}

/**
 * Create a list of numbers from `from` to `to` (both inclusive).
 *
 * @param from
 * @param to
 * @returns
 */
function range(from: number, to: number): number[] {
  return _range(from, to)
}

export { range }
