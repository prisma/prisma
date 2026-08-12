/**
 * Entity coordinate for a domain enum or storage value-set reference.
 *
 * Field-name identity with the framework's `EntityCoordinate` type
 * (packages/1-framework/1-core/framework-components/src/ir/storage.ts).
 * Foundation-contract cannot import framework-components (dependency points
 * the other way), so this is a standalone mirror of that shape plus the
 * cross-space discriminator.
 *
 * One-vocabulary rule (ADR 224): `entityKind` is equal to the entries slot
 * key the referenced entity lives under — `'enum'` for domain's `enum` slot,
 * `'valueSet'` for storage's `entries.valueSet` slot. No consumer-side
 * translation between the kind string and the slot key.
 *
 * Every `valueSet` reference is intra-plane (domain field → domain enum;
 * storage column/check → storage value-set). The directional invariant:
 * domain may reference storage; storage may never reference domain.
 *
 * `namespaceId` admits the `UNBOUND_NAMESPACE_ID` (`__unbound__`) sentinel
 * for single-namespace (unbound) references.
 *
 * `spaceId` is the cross-space discriminator: absent ⇒ local (same
 * contract-space); present ⇒ cross-space. No separate tag field.
 */
export interface ValueSetRef {
  readonly plane: 'domain' | 'storage';
  readonly namespaceId: string;
  readonly entityKind: 'enum' | 'valueSet';
  readonly entityName: string;
  readonly spaceId?: string;
}
