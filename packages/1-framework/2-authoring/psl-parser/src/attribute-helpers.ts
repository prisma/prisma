import type { PslAttribute } from '@internal/framework-components/psl-ast';

export function getPositionalArgument(attribute: PslAttribute, index = 0): string | undefined {
  const entries = attribute.args.filter((arg) => arg.kind === 'positional');
  return entries[index]?.value;
}

export function parseQuotedStringLiteral(value: string): string | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/^(['"])(.*)\1$/);
  if (!match) return undefined;
  return match[2] ?? '';
}
