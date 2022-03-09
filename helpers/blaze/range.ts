/* eslint-disable @typescript-eslint/no-unsafe-argument */
// eslint-disable-next-line @typescript-eslint/no-unused-vars

function _range(from: number, to: number, range: number[] = []): number[] {
  if (from === to) return [...range, from]
  if (from > to) return _range(from - 1, to, [...range, from])
  if (from < to) return _range(from + 1, to, [...range, from])

  return range
}

/**
 * Create a list of numbers from `from` to `to`.
 *
 * @param from
 * @param to
 * @returns
 */
function range(from: number, to: number): number[] {
  return _range(from, to)
}

export { range }
