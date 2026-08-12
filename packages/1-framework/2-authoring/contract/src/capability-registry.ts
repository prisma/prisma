export type CapabilityMatrix = Readonly<Record<string, Readonly<Record<string, boolean>>>>;

/**
 * Deep-merges any number of capability matrices into a single matrix.
 *
 * Merge is purely structural — namespaces and capability flags from later
 * sources overlay earlier ones. Undefined entries are skipped so callers
 * can pass optional sources without pre-filtering.
 *
 * The helper is target-agnostic: it contains no SQL or family-specific
 * knowledge. Higher layers contribute their own capability matrices (for
 * example, a target pack, an extension pack, or the contract author's
 * own `capabilities` block) and call this helper to fold them together.
 */
export function mergeCapabilityMatrices(
  ...sources: ReadonlyArray<CapabilityMatrix | undefined>
): Record<string, Record<string, boolean>> {
  const result: Record<string, Record<string, boolean>> = {};
  for (const source of sources) {
    if (source === undefined) continue;
    for (const [namespace, capabilities] of Object.entries(source)) {
      const existing = result[namespace];
      result[namespace] = existing ? { ...existing, ...capabilities } : { ...capabilities };
    }
  }
  return result;
}
