import type { ColumnTypeDescriptor } from '@internal/framework-components/codec';

export function columnDescriptor(
  codecId: string,
  nativeType?: string,
  typeParams?: Record<string, unknown>,
): ColumnTypeDescriptor {
  const derived = nativeType ?? codecId.match(/^[^/]+\/([^@]+)@/)?.[1] ?? codecId;
  return {
    codecId,
    nativeType: derived,
    ...(typeParams ? { typeParams } : {}),
  };
}
