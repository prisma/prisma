import { sqliteAdapterContractContributions } from '@internal/adapter-sqlite/adapter';
import sqlFamilyPack from '@internal/family-sql/pack';
import {
  assembleDataTypes,
  type CodecLookupWithDescriptors,
  type DataTypeLookup,
} from '@internal/framework-components/codec';
import type { ExtensionPackRef, TargetPackRef } from '@internal/framework-components/components';
import type {
  AuthoredStorageTypeInstance,
  SqlNamespaceBase,
  SqlNamespaceInput,
} from '@internal/sql-contract/types';
import type {
  ComposedAuthoringHelpers,
  ContractInput,
  EnumTypeHandle,
  MergeEnums,
  ModelLike,
} from '@internal/sql-contract-ts/contract-builder';
import { buildBoundContract } from '@internal/sql-contract-ts/contract-builder';
import { assembleSqliteCodecRegistry } from '@internal/target-sqlite/codecs';
import { sqliteCreateNamespace } from '@internal/target-sqlite/control';
import sqlitePack from '@internal/target-sqlite/pack';

type SqlFamily = typeof sqlFamilyPack;
type SqlitePack = typeof sqlitePack;

type TypesConstraint = Record<string, AuthoredStorageTypeInstance>;
type ModelsConstraint = Record<string, ModelLike>;
type EnumsConstraint = Record<string, EnumTypeHandle>;

/** What the adapter this contract runs with adds to it: its capabilities and its aggregate overloads, as `prisma contract emit` adds them. */
type SqliteAdapter = typeof sqliteAdapterContractContributions;

const adapter: SqliteAdapter = sqliteAdapterContractContributions;

type SqliteResult<
  Types extends TypesConstraint,
  Models extends ModelsConstraint,
  Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined,
  Enums extends EnumsConstraint,
> = ReturnType<
  typeof buildBoundContract<
    SqlFamily,
    SqlitePack,
    {
      readonly types?: Types;
      readonly models?: Models;
      readonly extensions?: Extensions;
      readonly enums?: Enums;
      readonly adapter: SqliteAdapter;
      readonly createNamespace: (input: SqlNamespaceInput) => SqlNamespaceBase;
      readonly codecLookup: CodecLookupWithDescriptors;
      readonly dataTypeLookup: DataTypeLookup;
    }
  >
>;

type SqliteBaseScaffold<
  Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined,
> = Omit<
  ContractInput<SqlFamily, SqlitePack, Record<never, never>, Record<never, never>, Extensions>,
  | 'family'
  | 'target'
  | 'adapter'
  | 'types'
  | 'models'
  | 'enums'
  | 'namespaces'
  | 'createNamespace'
  | 'codecLookup'
  | 'dataTypeLookup'
> & {
  /** Overrides the codecs of the target and the extensions. */
  readonly codecLookup?: CodecLookupWithDescriptors;
  /** Overrides the data types of the target and the extensions. */
  readonly dataTypeLookup?: DataTypeLookup;
};

type SqliteDefinition<
  Types extends TypesConstraint,
  Models extends ModelsConstraint,
  Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined,
  Enums extends EnumsConstraint,
> = SqliteBaseScaffold<Extensions> & {
  readonly types?: Types;
  readonly models?: Models;
  readonly enums?: Enums;
};

type SqliteScaffold<
  Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined,
  Enums extends EnumsConstraint,
> = SqliteBaseScaffold<Extensions> & {
  readonly enums?: Enums;
};

const target: TargetPackRef<'sql', 'sqlite'> = sqlitePack;

export function defineContract<
  const Types extends TypesConstraint = Record<never, never>,
  const Models extends ModelsConstraint = Record<never, never>,
  const Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined = undefined,
  const Enums extends EnumsConstraint = Record<never, never>,
>(
  definition: SqliteDefinition<Types, Models, Extensions, Enums>,
): SqliteResult<Types, Models, Extensions, Enums>;

export function defineContract<
  const Types extends TypesConstraint = Record<never, never>,
  const Models extends ModelsConstraint = Record<never, never>,
  const Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined = undefined,
  const ScaffoldEnums extends EnumsConstraint = Record<never, never>,
  const FactoryEnums extends EnumsConstraint = Record<never, never>,
>(
  scaffold: SqliteScaffold<Extensions, ScaffoldEnums>,
  factory: (helpers: ComposedAuthoringHelpers<SqlFamily, SqlitePack, Extensions>) => {
    readonly types?: Types;
    readonly models?: Models;
    readonly enums?: FactoryEnums;
  },
): SqliteResult<Types, Models, Extensions, MergeEnums<ScaffoldEnums, FactoryEnums>>;

// Implementation — delegates to buildBoundContract which pre-binds family/target,
// carrying zero casts at this layer.
export function defineContract(
  definition: SqliteDefinition<TypesConstraint, ModelsConstraint, undefined, EnumsConstraint>,
  factory?: (helpers: ComposedAuthoringHelpers<SqlFamily, SqlitePack, undefined>) => {
    readonly types?: TypesConstraint;
    readonly models?: ModelsConstraint;
    readonly enums?: EnumsConstraint;
  },
): SqliteResult<TypesConstraint, ModelsConstraint, undefined, EnumsConstraint> {
  const extensionPacks: readonly ExtensionPackRef<'sql', string>[] = Object.values(
    definition.extensions ?? {},
  );
  const bound = {
    ...definition,
    adapter,
    createNamespace: sqliteCreateNamespace,
    codecLookup: definition.codecLookup ?? assembleSqliteCodecRegistry(target, extensionPacks),
    dataTypeLookup:
      definition.dataTypeLookup ?? assembleDataTypes([target, ...extensionPacks]).lookup,
  };
  if (factory !== undefined) {
    return buildBoundContract(sqlFamilyPack, sqlitePack, bound, factory);
  }
  return buildBoundContract(sqlFamilyPack, sqlitePack, bound);
}
