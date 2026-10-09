import {
  asNamespaceId,
  type ContractModelBase,
  type ContractRelation,
  type ContractWithDomain,
  effectiveControlPolicy,
} from '@internal/contract/types';
import {
  describeMigrationStatement,
  type FieldCoordinate,
  type MigrationPlannerConflict,
  type MigrationSubject,
  type ModelCoordinate,
  modelDisplayName,
  type ResolvedFieldRenameStatement,
  type ResolvedMigrationStatement,
  type ResolvedModelRenameStatement,
} from '@internal/framework-components/control';
import type { MongoContract } from '@internal/mongo-contract';
import { MongoSchemaCollection, MongoSchemaIR } from '@internal/mongo-schema-ir';
import { notOk, ok, type Result } from '@internal/utils/result';
import { unrewritableFieldNameReason } from './migration-factories';
import {
  type OpFactoryCall,
  RenameCollectionCall,
  RenameFieldCall,
  UnsetFieldCall,
} from './op-factory-call';

type Document = Record<string, unknown>;

/** The collection a model stores its documents in; a model without `@@map` names it verbatim. */
export function collectionOf(
  contract: ContractWithDomain | null,
  coordinate: ModelCoordinate,
): string {
  const collection =
    contract?.domain.namespaces[coordinate.namespaceId]?.models[coordinate.model]?.storage[
      'collection'
    ];
  return typeof collection === 'string' ? collection : coordinate.model;
}

function modelAt(
  contract: ContractWithDomain,
  coordinate: ModelCoordinate,
): ContractModelBase | undefined {
  const namespace = contract.domain.namespaces[coordinate.namespaceId];
  return namespace !== undefined && Object.hasOwn(namespace.models, coordinate.model)
    ? namespace.models[coordinate.model]
    : undefined;
}

/**
 * The condition that selects a variant's documents in the collection it shares with its base: the
 * base's discriminator field holding the variant's value. A model that is not a variant has none.
 */
function variantFilter(
  contract: ContractWithDomain,
  coordinate: ModelCoordinate,
): Document | undefined {
  const base = modelAt(contract, coordinate)?.base;
  if (base === undefined) return undefined;
  const baseModel = contract.domain.namespaces[base.namespace]?.models[base.model];
  const field = baseModel?.discriminator?.field;
  const value = baseModel?.variants?.[coordinate.model]?.value;
  return field === undefined || value === undefined ? undefined : { [field]: value };
}

function collectionControlPolicy(contract: MongoContract, collection: string) {
  const declared = Object.values(contract.storage.namespaces)
    .map((namespace) => namespace?.entries.collection?.[collection])
    .find((entry) => entry !== undefined);
  return effectiveControlPolicy(declared?.control, contract.defaultControlPolicy);
}

/** Why MongoDB would refuse a collection name, if it would. */
function invalidCollectionNameReason(name: string): string | undefined {
  if (name === '') return 'it is empty';
  if (name.includes('$')) return 'it contains "$"';
  if (name.includes('\0')) return 'it contains a null character';
  if (name.startsWith('system.')) return 'it starts with "system.", which MongoDB reserves';
  return undefined;
}

function isEmbedRelation(relation: ContractRelation): boolean {
  return !('on' in relation) && !('through' in relation);
}

type StoredField =
  | { readonly kind: 'field' }
  | { readonly kind: 'reference' }
  | { readonly kind: 'embed' }
  | { readonly kind: 'absent' };

function storedField(model: ContractModelBase | undefined, field: string): StoredField {
  if (model === undefined) return { kind: 'absent' };
  if (Object.hasOwn(model.fields, field)) return { kind: 'field' };
  const relation = Object.hasOwn(model.relations, field) ? model.relations[field] : undefined;
  if (relation === undefined) return { kind: 'absent' };
  return isEmbedRelation(relation) ? { kind: 'embed' } : { kind: 'reference' };
}

/**
 * The calls statements and removed fields add to a plan, with the schema the diff starts from:
 * the origin with each renamed collection under its new name, so the diff does not drop and
 * create it again.
 */
export interface StatementCalls {
  readonly schema: MongoSchemaIR;
  /** Run first. */
  readonly collectionRenames: readonly RenameCollectionCall[];
  /** Run after index drops and before index creates. */
  readonly rewrites: readonly (RenameFieldCall | UnsetFieldCall)[];
}

export interface StatementPlan {
  /** The origin schema with each renamed collection under its new name, for the diff to compare. */
  readonly schema: MongoSchemaIR;
  readonly collectionRenames: readonly RenameCollectionCall[];
  readonly fieldRenames: readonly RenameFieldCall[];
  /** For each statement, in order, the call that carries it out, or `undefined` when storage does not change. */
  readonly callOfStatement: readonly (OpFactoryCall | undefined)[];
}

function refused(
  statement: ResolvedMigrationStatement,
  label: string,
  reason: string,
  why: string,
): MigrationPlannerConflict {
  return {
    kind: 'statementRefused',
    summary: `${label}: ${reason}`,
    why,
    refusedStatement: statement,
  };
}

const LEAVE_OUT = 'Leave out this statement.';

/**
 * Plans the rename each statement states, in order: a model statement whose collection changes renames the
 * collection in the schema the diff then starts from, and a field statement whose stored name
 * changes renames the field in the documents that hold it.
 */
export function planStatements(input: {
  readonly statements: readonly ResolvedMigrationStatement[];
  readonly fromContract: ContractWithDomain;
  readonly contract: MongoContract;
  readonly schema: MongoSchemaIR;
}): Result<StatementPlan, readonly MigrationPlannerConflict[]> {
  let schema = input.schema;
  const collectionRenames: RenameCollectionCall[] = [];
  const fieldRenames: RenameFieldCall[] = [];
  const callOfStatement: (OpFactoryCall | undefined)[] = [];
  const conflicts: MigrationPlannerConflict[] = [];
  const renamedCollections = new Map<string, string>();

  for (const statement of input.statements) {
    const label = `Cannot ${describeMigrationStatement(statement, input.fromContract, input.contract)}`;
    const outcome =
      statement.entity === 'model'
        ? planModelStatement(statement, label, schema, input)
        : planFieldStatement(statement, label, renamedCollections, input);
    if (outcome.kind === 'refused') {
      conflicts.push(outcome.conflict);
      callOfStatement.push(undefined);
      continue;
    }
    if (outcome.kind === 'renameCollection') {
      schema = renameInSchema(schema, outcome.call.from, outcome.call.to);
      renamedCollections.set(outcome.call.from, outcome.call.to);
      collectionRenames.push(outcome.call);
    }
    if (outcome.kind === 'renameField') fieldRenames.push(outcome.call);
    callOfStatement.push(outcome.kind === 'unchanged' ? undefined : outcome.call);
  }

  return conflicts.length > 0
    ? notOk(conflicts)
    : ok({ schema, collectionRenames, fieldRenames, callOfStatement });
}

type StatementOutcome =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'renameCollection'; readonly call: RenameCollectionCall }
  | { readonly kind: 'renameField'; readonly call: RenameFieldCall }
  | { readonly kind: 'refused'; readonly conflict: MigrationPlannerConflict };

function renameInSchema(schema: MongoSchemaIR, from: string, to: string): MongoSchemaIR {
  return new MongoSchemaIR(
    schema.collections.map((collection) =>
      collection.name === from
        ? new MongoSchemaCollection({
            name: to,
            indexes: collection.indexes,
            ...(collection.validator === undefined ? {} : { validator: collection.validator }),
            ...(collection.options === undefined ? {} : { options: collection.options }),
          })
        : collection,
    ),
  );
}

function controlPolicyRefusal(
  statement: ResolvedMigrationStatement,
  label: string,
  contract: MongoContract,
  collection: string,
): StatementOutcome | undefined {
  const policy = collectionControlPolicy(contract, collection);
  if (policy === 'managed') return undefined;
  return {
    kind: 'refused',
    conflict: refused(
      statement,
      label,
      `collection "${collection}" has control policy "${policy}"`,
      `Statements rename only collections, and fields of collections, whose control policy is "managed". Make the change in the database yourself and leave out this statement.`,
    ),
  };
}

/**
 * The reason and advice when a statement renames a variant whose discriminator value changes: its
 * documents keep the old value, which the new validator does not accept.
 */
function discriminatorValueChange(
  statement: ResolvedModelRenameStatement,
  input: { readonly fromContract: ContractWithDomain; readonly contract: MongoContract },
): readonly [reason: string, why: string] | undefined {
  const before = variantFilter(input.fromContract, statement.from);
  const after = variantFilter(input.contract, statement.to);
  const base = modelAt(input.contract, statement.to)?.base;
  if (before === undefined || after === undefined || base === undefined) return undefined;
  const [field, oldValue] = Object.entries(before)[0] ?? [];
  const newValue = Object.values(after)[0];
  if (field === undefined || oldValue === newValue) return undefined;
  const fromName = modelDisplayName(statement.from);
  const toName = modelDisplayName(statement.to);
  return [
    `its discriminator value changes from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}`,
    `The documents of "${fromName}" hold ${field} ${JSON.stringify(oldValue)}, and this release does not rewrite a discriminator value, so they would no longer match "${toName}" and would fail validation. Keep the value: declare "${toName}" with @@base(${base.model}, ${JSON.stringify(oldValue)}). A later release changes a stored value with --convert.`,
  ];
}

function planModelStatement(
  statement: ResolvedModelRenameStatement,
  label: string,
  schema: MongoSchemaIR,
  input: { readonly fromContract: ContractWithDomain; readonly contract: MongoContract },
): StatementOutcome {
  const discriminatorChange = discriminatorValueChange(statement, input);
  if (discriminatorChange !== undefined) {
    return { kind: 'refused', conflict: refused(statement, label, ...discriminatorChange) };
  }
  const from = collectionOf(input.fromContract, statement.from);
  const to = collectionOf(input.contract, statement.to);
  if (from === to) return { kind: 'unchanged' };
  const policyRefusal = controlPolicyRefusal(statement, label, input.contract, to);
  if (policyRefusal !== undefined) return policyRefusal;
  const refuse = (reason: string, why: string): StatementOutcome => ({
    kind: 'refused',
    conflict: refused(statement, label, reason, why),
  });
  const source = schema.collection(from);
  if (source === undefined) {
    return refuse(
      `the schema being planned from has no collection "${from}"`,
      `The database has no collection "${from}", or "${from}" is a view, which MongoDB cannot rename. Inspect it with prisma db schema, or ${LEAVE_OUT.toLowerCase()}`,
    );
  }
  if (source.options?.timeseries !== undefined) {
    return refuse(
      `collection "${from}" is a time-series collection`,
      `MongoDB cannot rename a time-series collection. Leave out this statement. To keep the documents, first create collection "${to}" yourself with the same time-series options and copy them into it; the plan then drops "${from}" once --delete names the model.`,
    );
  }
  const invalid = invalidCollectionNameReason(to);
  if (invalid !== undefined) {
    return refuse(
      `MongoDB does not accept the collection name "${to}": ${invalid}`,
      'Give the model a collection name MongoDB accepts with @@map, then run this command again.',
    );
  }
  if (schema.collection(to) !== undefined) {
    return refuse(
      `the schema being planned from already has a collection "${to}"`,
      `A rename cannot replace a collection that already exists. Rename or drop collection "${to}" first, or ${LEAVE_OUT.toLowerCase()}`,
    );
  }
  return { kind: 'renameCollection', call: new RenameCollectionCall(from, to) };
}

function planFieldStatement(
  statement: ResolvedFieldRenameStatement,
  label: string,
  renamedCollections: ReadonlyMap<string, string>,
  input: { readonly fromContract: ContractWithDomain; readonly contract: MongoContract },
): StatementOutcome {
  const refuse = (reason: string, why: string): StatementOutcome => ({
    kind: 'refused',
    conflict: refused(statement, label, reason, why),
  });
  const fromField = storedField(modelAt(input.fromContract, statement.from), statement.from.field);
  const toField = storedField(modelAt(input.contract, statement.to), statement.to.field);
  if (fromField.kind === 'embed' || toField.kind === 'embed') {
    return refuse(
      'the field is an embedded relation',
      `Renaming an embedded relation is not supported in this release. ${LEAVE_OUT}`,
    );
  }
  if (fromField.kind !== 'field' && toField.kind !== 'field') return { kind: 'unchanged' };
  if (fromField.kind !== 'field' || toField.kind !== 'field') {
    return refuse(
      'the field is stored in documents on one side of the statement only',
      `A relation is not stored in documents, so a statement cannot rename a field to or from one. ${LEAVE_OUT}`,
    );
  }
  if (statement.from.field === '_id' || statement.to.field === '_id') {
    return refuse('it renames _id', `MongoDB does not let a document change its _id. ${LEAVE_OUT}`);
  }
  const unsafeFrom = unrewritableFieldNameReason(statement.from.field);
  if (unsafeFrom !== undefined) {
    return refuse(
      `the stored field name "${statement.from.field}" cannot be rewritten`,
      `${unsafeFrom}, so a statement cannot move its values. Rename it in the database yourself, or ${LEAVE_OUT.toLowerCase()}`,
    );
  }
  const unsafeTo = unrewritableFieldNameReason(statement.to.field);
  if (unsafeTo !== undefined) {
    return refuse(
      `the stored field name "${statement.to.field}" cannot be written`,
      `${unsafeTo}. Give the field a stored name without "." that does not start with "$" (with @map), or ${LEAVE_OUT.toLowerCase()}`,
    );
  }
  const originCollection = collectionOf(input.fromContract, statement.from);
  const collection = renamedCollections.get(originCollection) ?? originCollection;
  const destinationCollection = collectionOf(input.contract, statement.to);
  if (collection !== destinationCollection) {
    return refuse(
      `the model's collection changes from "${originCollection}" to "${destinationCollection}", and no statement renames it`,
      collectionChangeAdvice(statement, originCollection, destinationCollection),
    );
  }
  if (statement.from.field === statement.to.field) return { kind: 'unchanged' };
  const policyRefusal = controlPolicyRefusal(statement, label, input.contract, collection);
  if (policyRefusal !== undefined) return policyRefusal;
  const filter =
    variantFilter(input.fromContract, statement.from) ??
    rootDocumentsLosing(input.contract, statement.to, statement.from.field)?.filter;
  return {
    kind: 'renameField',
    call: new RenameFieldCall(collection, statement.from.field, statement.to.field, filter),
  };
}

function collectionChangeAdvice(
  statement: ResolvedFieldRenameStatement,
  from: string,
  to: string,
): string {
  if (!sameModel(statement.from, statement.to)) {
    return `Add --rename ${modelDisplayName(statement.from)}:${modelDisplayName(statement.to)} before this statement, so the collection is renamed with its documents.`;
  }
  return `A statement cannot rename the collection of a model that keeps its name. Rename the collection in a step of its own first: change only @@map and emit the contract. With db update, rename the collection in the database yourself, for example db.getCollection(${JSON.stringify(from)}).renameCollection(${JSON.stringify(to)}) in mongosh, then run db update. With migration plan, plan it, passing --delete ${modelDisplayName(statement.from)} to answer its question; in its migration.ts replace the drop of "${from}" and the create of "${to}" with renameCollection(${JSON.stringify(from)}, ${JSON.stringify(to)}), imported with the other operations; run node migration.ts in the migration's directory, so it writes ops.json again; then apply it with migrate. Then change the field and run this statement again.`;
}

export interface FieldRemoval {
  readonly call: UnsetFieldCall;
  readonly subject: MigrationSubject;
}

function modelCoordinates(contract: ContractWithDomain): readonly ModelCoordinate[] {
  return Object.entries(contract.domain?.namespaces ?? {}).flatMap(([namespaceId, namespace]) =>
    Object.keys(namespace.models).map((model) => ({
      namespaceId: asNamespaceId(namespaceId),
      model,
    })),
  );
}

function sameModel(a: ModelCoordinate, b: ModelCoordinate): boolean {
  return a.namespaceId === b.namespaceId && a.model === b.model;
}

/**
 * The destination model an origin model became: the one a statement renamed it to, else the one of
 * the same name, else the only one stored the same way (same collection, same variant value).
 */
function destinationModelOf(
  origin: ModelCoordinate,
  input: FieldRemovalInput,
): ModelCoordinate | undefined {
  const renamed = input.statements.find(
    (statement): statement is ResolvedModelRenameStatement =>
      statement.entity === 'model' && sameModel(statement.from, origin),
  );
  if (renamed !== undefined) return renamed.to;
  if (modelAt(input.contract, origin) !== undefined) return origin;
  const collection = input.collectionAfterRenames(collectionOf(input.fromContract, origin));
  const filter = JSON.stringify(variantFilter(input.fromContract, origin) ?? null);
  const stored = modelCoordinates(input.contract).filter(
    (candidate) =>
      collectionOf(input.contract, candidate) === collection &&
      JSON.stringify(variantFilter(input.contract, candidate) ?? null) === filter,
  );
  const [only] = stored;
  return stored.length === 1 ? only : undefined;
}

interface FieldRemovalInput {
  readonly statements: readonly ResolvedMigrationStatement[];
  readonly fromContract: ContractWithDomain;
  readonly contract: MongoContract;
  readonly collectionAfterRenames: (collection: string) => string;
  readonly keptCollections: ReadonlySet<string>;
}

function renamedByStatement(input: FieldRemovalInput, field: FieldCoordinate): boolean {
  return input.statements.some(
    (statement) =>
      statement.entity === 'field' &&
      sameModel(statement.from, field) &&
      statement.from.field === field.field,
  );
}

function storedFieldsOf(contract: ContractWithDomain, coordinate: ModelCoordinate): Set<string> {
  const model = modelAt(contract, coordinate);
  if (model === undefined) return new Set();
  const base =
    model.base === undefined
      ? undefined
      : modelAt(contract, {
          namespaceId: asNamespaceId(model.base.namespace),
          model: model.base.model,
        });
  return new Set([...Object.keys(model.fields), ...Object.keys(base?.fields ?? {})]);
}

/**
 * The documents of a root model that lose `field`: all of them, or, when some of its destination
 * variants now store the field themselves, those whose discriminator value is none of theirs.
 * `undefined` when the root model itself still stores it.
 */
function rootDocumentsLosing(
  contract: ContractWithDomain,
  root: ModelCoordinate,
  field: string,
): { readonly filter: Document | undefined } | undefined {
  const model = modelAt(contract, root);
  if (model === undefined || Object.hasOwn(model.fields, field)) return undefined;
  const discriminator = model.discriminator?.field;
  const keeping = Object.entries(model.variants ?? {})
    .filter(([variant]) =>
      Object.hasOwn(modelAt(contract, { ...root, model: variant })?.fields ?? {}, field),
    )
    .map(([, entry]) => entry.value)
    .sort();
  if (discriminator === undefined || keeping.length === 0) return { filter: undefined };
  return { filter: { [discriminator]: { $nin: keeping } } };
}

/**
 * Each field an origin model stores that its destination model no longer stores, in a collection
 * the plan keeps: removing it is data loss, carried out by unsetting it from the documents that
 * hold it, in a collection whose control policy is `managed`. A variant's field is unset only from that variant's documents, unless its destination
 * base now stores it. A base field is unset from the documents of every variant that does not now
 * store it itself.
 */
export function planFieldRemovals(input: FieldRemovalInput): readonly FieldRemoval[] {
  return modelCoordinates(input.fromContract).flatMap((origin) => {
    const collection = input.collectionAfterRenames(collectionOf(input.fromContract, origin));
    if (!input.keptCollections.has(collection)) return [];
    if (collectionControlPolicy(input.contract, collection) !== 'managed') return [];
    const destination = destinationModelOf(origin, input);
    if (destination === undefined) return [];
    const model = modelAt(input.fromContract, origin);
    if (model === undefined) return [];
    const variant = variantFilter(input.fromContract, origin);
    const losing = (field: string): { readonly filter: Document | undefined } | undefined => {
      if (variant !== undefined) {
        return storedFieldsOf(input.contract, destination).has(field)
          ? undefined
          : { filter: variant };
      }
      return rootDocumentsLosing(input.contract, destination, field);
    };
    return Object.keys(model.fields)
      .filter(
        (field) =>
          unrewritableFieldNameReason(field) === undefined &&
          !renamedByStatement(input, { ...origin, field }),
      )
      .sort()
      .flatMap((field) => {
        const lost = losing(field);
        return lost === undefined
          ? []
          : [
              {
                call: new UnsetFieldCall(collection, field, lost.filter),
                subject: { kind: 'field' as const, ...origin, field },
              },
            ];
      });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function propertyNames(schema: unknown): readonly string[] {
  const properties = isRecord(schema) ? schema['properties'] : undefined;
  return isRecord(properties) ? Object.keys(properties) : [];
}

function branchPropertyNames(schema: unknown): readonly string[] {
  const branches = isRecord(schema) ? schema['oneOf'] : undefined;
  return Array.isArray(branches) ? branches.flatMap(propertyNames) : [];
}

/**
 * Without an origin contract, a field is known removed when the origin validator declares it at the
 * top level and the destination validator declares it nowhere. It is named by its storage name.
 */
export function planValidatorFieldRemovals(input: {
  readonly origin: MongoSchemaIR;
  readonly destination: MongoSchemaIR;
  readonly contract: MongoContract;
}): readonly FieldRemoval[] {
  return input.origin.collections.flatMap((originCollection) => {
    if (collectionControlPolicy(input.contract, originCollection.name) !== 'managed') return [];
    const destination = input.destination.collection(originCollection.name);
    if (destination?.validator === undefined || originCollection.validator === undefined) return [];
    const kept = new Set([
      ...propertyNames(destination.validator?.jsonSchema),
      ...branchPropertyNames(destination.validator?.jsonSchema),
    ]);
    return propertyNames(originCollection.validator.jsonSchema)
      .filter((field) => unrewritableFieldNameReason(field) === undefined && !kept.has(field))
      .sort()
      .map((field) => ({
        call: new UnsetFieldCall(originCollection.name, field),
        subject: { kind: 'storage' as const, name: `${originCollection.name}.${field}` },
      }));
  });
}
