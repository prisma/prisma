export function timeElapsedInMs(startNs: bigint, endNs: bigint): number {
  const t = endNs - startNs
  const m = 1_000_000,
    bm = BigInt(m)
  const d = t / bm
  const r = t % bm
  return Number(d) + Number(r) / m
}
