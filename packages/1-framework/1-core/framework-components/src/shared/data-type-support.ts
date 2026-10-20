import { assembleDataTypes, type DataType, type DataTypeId } from './data-type';
import {
  type AuthoringContributions,
  type AuthoringFieldPresetDescriptor,
  type AuthoringTypeConstructorDescriptor,
  type DataTypeAuthoringEntry,
  isAuthoringFieldPresetDescriptor,
  isAuthoringTypeConstructorDescriptor,
} from './framework-authoring';
import { runtimeError } from './runtime-error';
import type { DataTypeSupport } from './written-value';

/** A component as data type assembly reads it: the data types it registers, their authoring entries, and the type constructors and field presets whose value arguments name them. */
export interface DataTypeComponent {
  readonly id?: string;
  readonly dataTypes?: ReadonlyArray<DataType>;
  readonly authoring?: Pick<AuthoringContributions, 'dataTypes' | 'type' | 'field'>;
}

/** A type constructor or field preset, with the path it is registered under and who registered it. */
export interface ContributedConstructor {
  readonly path: string;
  readonly descriptor: AuthoringTypeConstructorDescriptor | AuthoringFieldPresetDescriptor;
  readonly contributedBy: string;
}

export interface AssembledDataTypeSupport {
  readonly support: DataTypeSupport;
  /** Every data type the components register, with the id of the component that registered it. */
  readonly declared: ReadonlyArray<{ readonly type: DataType; readonly contributedBy: string }>;
}

const UNKNOWN_CONTRIBUTOR = '<unknown>';

/** Merge every component's PSL support for its data types, refusing two claims on one key. */
export function assembleAuthoringDataTypes(
  components: ReadonlyArray<Pick<DataTypeComponent, 'id' | 'authoring'>>,
): Readonly<Record<string, DataTypeAuthoringEntry>> {
  const merged: Record<string, DataTypeAuthoringEntry> = {};
  const owners = new Map<string, string>();

  for (const component of components) {
    const contributedBy = component.id ?? UNKNOWN_CONTRIBUTOR;
    for (const [key, entry] of Object.entries(component.authoring?.dataTypes ?? {})) {
      const existingOwner = owners.get(key);
      if (existingOwner !== undefined) {
        throw runtimeError(
          'CONTRACT.DATA_TYPE_ENTRY_DUPLICATE',
          `Duplicate authoring entry for "${key}". Component "${contributedBy}" conflicts with "${existingOwner}".`,
          { key, contributedBy, owner: existingOwner },
        );
      }
      owners.set(key, contributedBy);
      merged[key] = entry;
    }
  }

  return merged;
}

type AuthoringTree<D> = { readonly [name: string]: D | AuthoringTree<D> };

function descriptorsIn<D>(
  namespace: AuthoringTree<D> | undefined,
  isLeaf: (value: D | AuthoringTree<D>) => value is D,
  path: readonly string[] = [],
): ReadonlyArray<{ readonly path: string; readonly descriptor: D }> {
  return Object.entries(namespace ?? {}).flatMap(([key, value]) => {
    const currentPath = [...path, key];
    if (isLeaf(value)) return [{ path: currentPath.join('.'), descriptor: value }];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    return descriptorsIn(value, isLeaf, currentPath);
  });
}

/** Every type constructor and field preset a component contributes. */
export function contributedConstructors(
  component: Pick<DataTypeComponent, 'id' | 'authoring'>,
): readonly ContributedConstructor[] {
  return [
    ...descriptorsIn(component.authoring?.type, isAuthoringTypeConstructorDescriptor),
    ...descriptorsIn(component.authoring?.field, isAuthoringFieldPresetDescriptor),
  ].map((entry) => ({ ...entry, contributedBy: component.id ?? UNKNOWN_CONTRIBUTOR }));
}

/** The data types a contract source can write: each entry's own, and every type a plain-number entry classifies a number as. */
export function writableDataTypes(
  entries: Readonly<Record<string, DataTypeAuthoringEntry>>,
): ReadonlySet<string> {
  return new Set(
    Object.entries(entries).flatMap(([key, entry]) => [
      key,
      ...(entry.written.kind === 'plain' && entry.written.syntax === 'number'
        ? entry.written.types
        : []),
    ]),
  );
}

/** Refuses a value argument whose data type is unregistered, or that no contract source can write, directly or through a cast. */
function enforceValueArguments(
  support: DataTypeSupport,
  contributed: ContributedConstructor,
  writable: ReadonlySet<string>,
): void {
  const { path, descriptor, contributedBy } = contributed;
  const kind = descriptor.kind === 'typeConstructor' ? 'type constructor' : 'field preset';
  for (const [index, argument] of (descriptor.args ?? []).entries()) {
    if (argument.kind !== 'value') continue;
    const label = `Argument ${argument.name === undefined ? `#${index + 1}` : `"${argument.name}"`} of ${kind} "${path}"`;
    const type = support.lookup.get(argument.dataType);
    if (type === undefined) {
      throw runtimeError(
        'CONTRACT.DATA_TYPE_UNREGISTERED',
        `${label} names data type "${argument.dataType}", which no component registers. Contributed by "${contributedBy}".`,
        { dataType: argument.dataType, contributedBy },
      );
    }
    const admitted = [argument.dataType, ...Object.keys(type.casts)];
    if (!admitted.some((admittedType) => writable.has(admittedType))) {
      throw runtimeError(
        'CONTRACT.DATA_TYPE_NOT_WRITABLE',
        `${label} contributed by "${contributedBy}" takes a value of data type "${argument.dataType}", which no contract source can write.`,
        { dataType: argument.dataType, contributedBy },
      );
    }
  }
}

/**
 * The data types the components register, with their authoring entries, as every contract source reads values with. Refuses two registrations of one data type or one entry key, and a value argument of a type constructor or field preset whose data type is unregistered or that no contract source can write. ADR 254.
 */
export function assembleDataTypeSupport(
  components: ReadonlyArray<DataTypeComponent>,
  dataTypeOfCodec: (codecId: string) => DataTypeId | undefined,
): AssembledDataTypeSupport {
  const { lookup, declared } = assembleDataTypes(components);
  const entries = assembleAuthoringDataTypes(components);
  const support: DataTypeSupport = { entries, lookup, dataTypeOfCodec };
  const writable = writableDataTypes(entries);
  for (const contributed of components.flatMap(contributedConstructors)) {
    enforceValueArguments(support, contributed, writable);
  }
  return { support, declared };
}
