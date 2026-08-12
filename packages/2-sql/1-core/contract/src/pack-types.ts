/**
 * Storage type metadata for pack refs.
 */
export interface StorageTypeMetadata {
  readonly typeId: string;
  readonly familyId: string;
  readonly targetId: string;
  readonly nativeType?: string;
}
