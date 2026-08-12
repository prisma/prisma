/**
 * Single descriptor-import boundary for CLI consumers of `Config.extensions`.
 *
 * Every CLI command / utility that reads an extension descriptor's
 * `contractSpace` projection (loader, migrate-pass, extension-migrations
 * pass, migration commands) goes through {@link toExtensionInputs}. The
 * structural cast `pack as { contractSpace?: ... }` lives **only** here —
 * downstream code consumes the canonical shape and maps it to its own
 * narrower shape via the per-consumer adapters below.
 *
 * The CLI receives extension descriptors typed against the SQL family
 * (or any other family in the future); this helper only depends on the
 * structural shape of `contractSpace`. SQL-family callers pass the same
 * `contractJson` / `headRef.hash` value through unchanged.
 */
import type { DeclaredExtensionEntry } from '@internal/migration-tools/aggregate';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import type { MigrationOps } from '@internal/migration-tools/package';

/**
 * In-memory authored migration package shipped by an extension descriptor.
 * Mirrors the `MigrationPackage` shape from
 * `@internal/framework-components/control` minus `dirPath`; redeclared
 * structurally here so the helper does not couple to the SQL family's
 * `ExtensionMigrationPackage` type.
 */
export interface DescriptorMigrationPackage {
  readonly dirName: string;
  readonly metadata: MigrationMetadata;
  readonly ops: MigrationOps;
}

/**
 * The most-general projection of a single declared extension pack
 * needed by the CLI's descriptor-import boundary.
 *
 * - `id` / `targetId` are always present.
 * - `contractSpace` is present only when the extension declares one.
 *   When present, it carries the canonical inputs every downstream
 *   consumer needs — `contractJson`, `headRef`, and the descriptor's
 *   pre-built migration packages.
 */
export interface ExtensionPackInput {
  readonly id: string;
  readonly targetId: string;
  readonly contractSpace?: {
    readonly contractJson: unknown;
    readonly headRef: {
      readonly hash: string;
      readonly invariants: readonly string[];
    };
    readonly migrations: readonly DescriptorMigrationPackage[];
  };
}

/**
 * Structural shape we read off each `Config.extensions` entry.
 *
 * The CLI is the descriptor-import boundary; `extensions` is the only
 * surface where the SQL-family-typed `ControlExtensionDescriptor` flows
 * into framework-neutral helpers. The structural cast lives here, and
 * here alone — every other CLI consumer reads the canonical
 * {@link ExtensionPackInput} shape produced by {@link toExtensionInputs}.
 */
type ExtensionPackLike = {
  readonly id: string;
  readonly targetId: string;
  readonly contractSpace?: {
    readonly contractJson: unknown;
    readonly headRef: {
      readonly hash: string;
      readonly invariants: readonly string[];
    };
    readonly migrations?: readonly DescriptorMigrationPackage[];
  };
};

/**
 * Project the CLI's `Config.extensions` array into the canonical
 * {@link ExtensionPackInput} shape. The single `as ExtensionPackLike`
 * structural cast in the CLI lives inside this function.
 */
export function toExtensionInputs(
  extensions: ReadonlyArray<unknown>,
): readonly ExtensionPackInput[] {
  return extensions.map((raw) => {
    const pack = raw as ExtensionPackLike;
    if (pack.contractSpace === undefined) {
      return { id: pack.id, targetId: pack.targetId };
    }
    return {
      id: pack.id,
      targetId: pack.targetId,
      contractSpace: {
        contractJson: pack.contractSpace.contractJson,
        headRef: pack.contractSpace.headRef,
        migrations: pack.contractSpace.migrations ?? [],
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Per-consumer adapters: take the canonical `ExtensionPackInput[]` and
// project to whatever narrower shape the downstream primitive needs.
// ---------------------------------------------------------------------------

/**
 * Aggregate-loader projection. Surfaces `id` + `targetId` per
 * contract-space-bearing extension to
 * {@link import('./contract-space-aggregate-loader').buildContractSpaceAggregate}.
 *
 * Codec-only extensions (no `contractSpace` declaration) are filtered
 * out: they contribute no contract space, so the aggregate loader
 * has nothing to do with them. Filtering happens at this descriptor-
 * import boundary so the loader stays oblivious to that distinction —
 * every entry it sees expects an on-disk `migrations/<id>/` directory.
 */
export function toDeclaredExtensions(
  inputs: ReadonlyArray<ExtensionPackInput>,
): readonly DeclaredExtensionEntry[] {
  const entries: DeclaredExtensionEntry[] = [];
  for (const pack of inputs) {
    if (pack.contractSpace === undefined) continue;
    entries.push({ id: pack.id, targetId: pack.targetId });
  }
  return entries;
}

/**
 * Minimal aggregate-loader projection that extracts `id` + `targetId`
 * from raw extension pack descriptors **without invoking any
 * `contractSpace` accessor**. Inspects the own-property descriptor so
 * that getter-backed `contractSpace` declarations are detected but
 * never called.
 *
 * Inclusion semantics match {@link toDeclaredExtensions}: a data
 * property whose value is explicitly `undefined` is treated as "no
 * contract-space declaration" and skipped, mirroring the
 * `pack.contractSpace === undefined` check used on canonicalised
 * inputs. Prototype-chain `contractSpace` properties (no own
 * descriptor) are also skipped.
 *
 * This variant must be used by `buildContractSpaceAggregate` so that
 * the aggregate path (including `db verify`) never reads
 * `contractSpace.contractJson` from extension descriptors — the loader
 * always reads the contract from on-disk artefacts instead.
 */
export function toDeclaredExtensionsFromRaw(
  extensions: ReadonlyArray<unknown>,
): readonly DeclaredExtensionEntry[] {
  const entries: DeclaredExtensionEntry[] = [];
  for (const raw of extensions) {
    if (typeof raw !== 'object' || raw === null) continue;
    const descriptor = Object.getOwnPropertyDescriptor(raw, 'contractSpace');
    if (descriptor === undefined) continue;
    if ('value' in descriptor && descriptor.value === undefined) continue;
    const pack = raw as { readonly id: string; readonly targetId: string };
    entries.push({ id: pack.id, targetId: pack.targetId });
  }
  return entries;
}
