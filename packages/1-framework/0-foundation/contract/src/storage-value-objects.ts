import { blindCast } from '@internal/utils/casts';
import type { ContractWithDomain } from './domain-envelope';
import type { ContractValueObject } from './domain-types';
import type { EntityCoordinate } from './entity-coordinate';
import { isPlainRecord } from './is-plain-record';

function valueObjectsOf(
  storage: ContractWithDomain['storage'],
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
  storage: ContractWithDomain['storage'],
  reference: EntityCoordinate<'storage', 'valueObject'>,
): ContractValueObject | undefined {
  const valueObjects = valueObjectsOf(storage, reference.namespaceId);
  return Object.hasOwn(valueObjects, reference.entityName)
    ? valueObjects[reference.entityName]
    : undefined;
}

/** Each value object in storage, in every namespace, with its coordinate. */
export function valueObjectsWithCoordinates(storage: ContractWithDomain['storage']): ReadonlyArray<{
  readonly coordinate: EntityCoordinate<'storage', 'valueObject'>;
  readonly valueObject: ContractValueObject;
}> {
  return Object.keys(storage.namespaces).flatMap((namespaceId) =>
    Object.entries(valueObjectsOf(storage, namespaceId)).map(([entityName, valueObject]) => ({
      coordinate: { plane: 'storage', namespaceId, entityKind: 'valueObject', entityName },
      valueObject,
    })),
  );
}
