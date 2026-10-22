// `string extends keyof SCT` detects the open `Record<string, never>` default that non-emitted contracts carry.
export type StorageColumnMapAt<
  SCT,
  NsId extends string,
  TableName extends string,
> = string extends keyof SCT
  ? never
  : NsId extends keyof SCT
    ? string extends keyof SCT[NsId]
      ? never
      : TableName extends keyof SCT[NsId]
        ? SCT[NsId][TableName]
        : never
    : never;

export type StorageColumnTypeAcrossNamespaces<
  SCT,
  TableName extends string,
  ColumnName extends string,
> = {
  [Ns in keyof SCT]: TableName extends keyof SCT[Ns]
    ? ColumnName extends keyof SCT[Ns][TableName]
      ? SCT[Ns][TableName][ColumnName]
      : never
    : never;
}[keyof SCT];
