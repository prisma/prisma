import { blindCast } from '@internal/utils/casts';

export type NamespaceId = string & { readonly __brand: 'NamespaceId' };

export function asNamespaceId(value: string): NamespaceId {
  return blindCast<
    NamespaceId,
    'NamespaceId is a compile-time-only brand on string; this factory is the sole assertion site'
  >(value);
}
