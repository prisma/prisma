import type { DefaultMappingOptions } from '@internal/family-sql/psl-infer';

const POSTGRES_FUNCTION_ATTRIBUTES: Readonly<Record<string, string>> = {
  'gen_random_uuid()': '@default(dbgenerated("gen_random_uuid()"))',
};

function formatDbGeneratedAttribute(expression: string): string {
  return `@default(dbgenerated(${JSON.stringify(expression)}))`;
}

export function createPostgresDefaultMapping(): DefaultMappingOptions {
  return {
    functionAttributes: POSTGRES_FUNCTION_ATTRIBUTES,
    fallbackFunctionAttribute: formatDbGeneratedAttribute,
  };
}
