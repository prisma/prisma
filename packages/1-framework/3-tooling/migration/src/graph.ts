/**
 * An entry in the migration graph. All on-disk migrations are attested,
 * so `migrationHash` is always a string.
 */
export interface MigrationEdge {
  readonly from: string;
  readonly to: string;
  readonly migrationHash: string;
  readonly dirName: string;
  readonly createdAt: string;
  /**
   * Sorted, deduplicated list of `invariantId`s this edge provides.
   * An empty array means the migration declares no routing-visible
   * data transforms.
   */
  readonly invariants: readonly string[];
}

export interface MigrationGraph {
  readonly nodes: ReadonlySet<string>;
  readonly forwardChain: ReadonlyMap<string, readonly MigrationEdge[]>;
  readonly reverseChain: ReadonlyMap<string, readonly MigrationEdge[]>;
  readonly migrationByHash: ReadonlyMap<string, MigrationEdge>;
}
