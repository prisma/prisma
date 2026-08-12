/**
 * Structural shape the aggregate planner / verifier accept for marker
 * rows. Mirrors `family.readAllMarkers(...)` outputs across SQL and
 * Mongo families: a `(storageHash, invariants)` pair plus an optional
 * `profileHash` the verifier uses to align the marker with the
 * destination contract's profile envelope.
 *
 * Typed structurally so `migration-tools` stays framework-neutral; SQL
 * and Mongo families pass their typed `ContractMarkerRecord` through
 * unchanged.
 */
export interface ContractMarkerRecordLike {
  readonly storageHash: string;
  readonly invariants: readonly string[];
  readonly profileHash?: string;
}
