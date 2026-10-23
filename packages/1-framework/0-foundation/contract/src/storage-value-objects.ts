import { blindCast } from '@internal/utils/casts';
import { contractError } from './contract-errors';
import type { ContractValueObject } from './domain-types';
import type { EntityCoordinate } from './entity-coordinate';
import { isPlainRecord } from './is-plain-record';
import type { StorageBase } from './types';

type StorageNamespaces = Pick<StorageBase, 'namespaces'>;

function valueObjectsOf(
  storage: StorageNamespaces,
  namespaceId: string,
): Readonly<Record<string, ContractValueObject>> {
  const slot = Object.hasOwn(storage.namespaces, namespaceId)
    ? storage.namespaces[namespaceId]?.entries?.['valueObject']
    : undefined;
  return isPlainRecord(slot)
    ? blindCast<
        Readonly<Record<string, ContractValueObject>>,
        'the family validators check each storage valueObject entry against the value object schema'
      >(slot)
    : {};
}

/** The storage value object a reference names, or `undefined` when storage does not have it. */
export function valueObjectAt(
  storage: StorageNamespaces,
  reference: EntityCoordinate<'storage', 'valueObject'>,
): ContractValueObject | undefined {
  const valueObjects = valueObjectsOf(storage, reference.namespaceId);
  return Object.hasOwn(valueObjects, reference.entityName)
    ? valueObjects[reference.entityName]
    : undefined;
}

/**
 * The value objects of the storage's only namespace. Throws when storage does not declare exactly one namespace, since a bare value object name is then ambiguous.
 */
export function storageValueObjectsAtDefaultNamespace(
  storage: StorageNamespaces,
): Readonly<Record<string, ContractValueObject>> {
  const namespaceIds = Object.keys(storage.namespaces);
  const [namespaceId] = namespaceIds;
  if (namespaceId === undefined || namespaceIds.length > 1) {
    throw contractError(
      'CONTRACT.NAMESPACE_INVALID',
      `bare-name resolution requires exactly one storage namespace, found ${namespaceIds.length} (${namespaceIds.join(', ')}); select a namespace explicitly`,
      { meta: { reason: 'multiple-storage-namespaces', namespaceIds } },
    );
  }
  return valueObjectsOf(storage, namespaceId);
}
