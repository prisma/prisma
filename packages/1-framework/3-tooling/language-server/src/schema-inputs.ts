import { pathToFileURL } from 'node:url';

export interface SchemaInputConfig {
  readonly contract?: {
    readonly source: {
      readonly format?: string;
      readonly inputs?: readonly string[];
    };
  };
}

export interface SchemaInputSet {
  includes(uri: string): boolean;
  uris(): Iterable<string>;
}

export function hasPslInputs(config: SchemaInputConfig): boolean {
  const source = config.contract?.source;
  return source?.format === 'psl' && source.inputs !== undefined;
}

export function resolveSchemaInputs(config: SchemaInputConfig): SchemaInputSet {
  const inputs = hasPslInputs(config) ? config.contract?.source.inputs : undefined;
  const uris = new Set(inputs?.map((input) => pathToFileURL(input).toString()));

  return {
    includes: (uri) => uris.has(uri),
    uris: () => uris,
  };
}

export const emptySchemaInputSet: SchemaInputSet = {
  includes: () => false,
  uris: () => [],
};
