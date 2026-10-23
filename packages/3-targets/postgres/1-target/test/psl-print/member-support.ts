import type { ContractField } from '@internal/contract/types';
import { deserialize, widgetContract } from './refusal-support';

/** A contract whose one value object, `Address`, has the one member `street`. */
export function addressContract(field: ContractField) {
  return deserialize(
    widgetContract({
      columns: { address: { dataType: 'pg/jsonb', codecId: 'pg/jsonb@1', nullable: false } },
      fields: {
        address: {
          nullable: false,
          type: {
            kind: 'valueObject',
            plane: 'storage',
            namespaceId: 'public',
            entityKind: 'valueObject',
            entityName: 'Address',
          },
        },
      },
      entries: { valueObject: { Address: { fields: { street: field } } } },
    }),
  );
}

const countryEnumParts = {
  enum: { Country: { codecId: 'pg/text@1', members: [{ name: 'DE', value: 'DE' }] } },
} as const;
export const countryValueSet = {
  plane: 'storage',
  entityKind: 'valueSet',
  namespaceId: 'public',
  entityName: 'Country',
} as const;

/** A contract whose value object `Address` has the given members, beside the domain enum `Country` and its value set, and the given other value sets. */
export function withCountryMembers(
  fields: Record<string, ContractField>,
  valueSets: Record<string, { readonly kind: 'valueSet'; readonly values: readonly string[] }> = {},
) {
  return deserialize(
    widgetContract({
      columns: { address: { dataType: 'pg/jsonb', codecId: 'pg/jsonb@1', nullable: false } },
      fields: {
        address: {
          nullable: false,
          type: {
            kind: 'valueObject',
            plane: 'storage',
            namespaceId: 'public',
            entityKind: 'valueObject',
            entityName: 'Address',
          },
        },
      },
      domain: countryEnumParts,
      entries: {
        valueSet: { Country: { kind: 'valueSet', values: ['DE'] }, ...valueSets },
        valueObject: { Address: { fields } },
      },
    }),
  );
}
