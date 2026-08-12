import { applySpecifierDefaultControlPolicy } from '@internal/contract/apply-specifier-default-control-policy';
import { computeStorageHash } from '@internal/contract/hashing';
import type { Contract, ControlPolicy } from '@internal/contract/types';
import { effectiveControlPolicy } from '@internal/contract/types';
import { sqlContractCanonicalizationHooks } from '@internal/sql-contract/canonicalization-hooks';
import {
  checkConstraintInputFromSerialized,
  isMaterializedSqlNamespace,
  type SqlNamespaceBase,
  type SqlNamespaceInput,
  SqlStorage,
  StorageTable,
} from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';

/**
 * Creates a namespace of the caller's target concretion. Same shape as the
 * `createNamespace` a contract specifier already threads through.
 */
export type SqlNamespaceFactory = (input: SqlNamespaceInput) => SqlNamespaceBase;

/**
 * The one step every SQL contract specifier funnels its loaded contract
 * through: stamp the specifier's default control policy, then strip derived
 * checks from every table the stamped policy leaves non-managed. Composing the
 * two here is what keeps the managed-only consequence from being skipped on
 * any specifier route.
 */
export function applySqlSpecifierControlPolicy(
  contract: Contract,
  defaultControlPolicy: ControlPolicy | undefined,
  createNamespace: SqlNamespaceFactory,
): Contract {
  return stripDerivedChecksFromNonManagedTables(
    applySpecifierDefaultControlPolicy(contract, defaultControlPolicy),
    createNamespace,
  );
}

/**
 * Removes generated enforcement checks from every table whose effective
 * control policy is not `managed`.
 *
 * A derived check is exactly a wire-named one — the ones authoring composes a
 * prefix and content hash for. The slice-3 opt-out surface (`@noCheck`)
 * re-examined this identification and it stands: the opt-out adds no producer
 * of checks — an opted-out check is never emitted — so wire-named remains
 * exactly "derived by authoring". The identification moves only when a
 * user-authored check surface exists (`@@check`, still a project non-goal),
 * at which point an authored check needs its own marker.
 *
 * Why derivation stops at the namespace boundary: the contract *describes* an
 * external schema, it does not *prescribe* enforcement for it. Deriving a check
 * for a table Prisma Next never creates declares a constraint the live database
 * has no reason to carry, and `external` fails verify on a declared shape the
 * database lacks — an unfixable failure, since no plan may emit DDL there
 * either.
 *
 * This is the post-build half of the rule. Authoring skips derivation for a
 * table whose policy is known in the source; this pass catches the policy a
 * contract *specifier* applies after the contract is already built, which is
 * the only signal a pack like the Supabase extension gives. Specifiers reach
 * it through `applySqlSpecifierControlPolicy` above.
 *
 * Returns the contract unchanged (same reference) when nothing is stripped.
 * When something is, the storage hash is recomputed — the stripped contract
 * describes different storage.
 */
export function stripDerivedChecksFromNonManagedTables(
  contract: Contract,
  createNamespace: SqlNamespaceFactory,
): Contract {
  const storage = contract.storage;
  if (!isSqlStorageShaped(storage)) return contract;

  let anyStripped = false;
  const namespaces: Record<string, SqlNamespaceBase> = {};

  for (const [namespaceId, namespace] of Object.entries(storage.namespaces)) {
    // A namespace that is still JSON-shaped cannot be rebuilt through the
    // target factory, and a built contract never holds one.
    if (!isMaterializedSqlNamespace(namespace)) return contract;
    const tables = namespace.entries['table'];
    if (tables === undefined) {
      namespaces[namespaceId] = namespace;
      continue;
    }

    let namespaceStripped = false;
    const nextTables: Record<string, StorageTable> = {};
    for (const [tableName, table] of Object.entries(tables)) {
      const stripped = StorageTable.is(table)
        ? withoutDerivedChecks(table, contract.defaultControlPolicy)
        : table;
      if (stripped !== table) namespaceStripped = true;
      nextTables[tableName] = stripped;
    }

    if (!namespaceStripped) {
      namespaces[namespaceId] = namespace;
      continue;
    }
    anyStripped = true;
    namespaces[namespaceId] = createNamespace({
      id: namespace.id,
      entries: { ...namespace.entries, table: nextTables },
    });
  }

  if (!anyStripped) return contract;

  const storageWithoutHash = {
    namespaces,
    ...ifDefined('types', storage.types),
  };
  return {
    ...contract,
    storage: new SqlStorage({
      ...storageWithoutHash,
      storageHash: computeStorageHash({
        target: contract.target,
        targetFamily: contract.targetFamily,
        storage: storageWithoutHash,
        ...sqlContractCanonicalizationHooks,
      }),
    }),
  };
}

/**
 * Structural stand-in for `instanceof SqlStorage`: like the checks it wraps, a
 * storage instance can arrive from a realm whose IR classes are a separate
 * copy (the dist e2e shape), where an `instanceof` test would miss.
 */
function isSqlStorageShaped(x: unknown): x is SqlStorage {
  if (typeof x !== 'object' || x === null || !('namespaces' in x)) return false;
  return typeof x.namespaces === 'object' && x.namespaces !== null;
}

/** The table itself when it keeps every check, a rebuilt one when it does not. */
function withoutDerivedChecks(
  table: StorageTable,
  contractDefault: ControlPolicy | undefined,
): StorageTable {
  const checks = table.checks;
  if (checks === undefined || checks.length === 0) return table;
  if (effectiveControlPolicy(table.control, contractDefault) === 'managed') return table;

  const kept = checks.filter((check) => check.prefix === undefined);
  if (kept.length === checks.length) return table;

  return new StorageTable({
    columns: table.columns,
    uniques: table.uniques,
    indexes: table.indexes,
    foreignKeys: table.foreignKeys,
    ...ifDefined('primaryKey', table.primaryKey),
    ...ifDefined('control', table.control),
    // Rebuilt from the flat form rather than handed back as instances: a
    // contract can arrive from a realm whose IR classes are a separate copy
    // (the dist e2e shape), where an `instanceof` normalization would miss.
    ...(kept.length > 0
      ? {
          checks: kept.map((check) =>
            checkConstraintInputFromSerialized({
              name: check.name,
              ...ifDefined('prefix', check.prefix),
              expression: check.expression,
            }),
          ),
        }
      : {}),
  });
}
