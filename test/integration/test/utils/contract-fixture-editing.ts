import { readFileSync, writeFileSync } from 'node:fs';

export function replaceInFileOrThrow(
  filePath: string,
  searchValue: string,
  replaceValue: string,
): void {
  const source = readFileSync(filePath, 'utf-8');
  const updated = source.replace(searchValue, replaceValue);

  if (updated === source) {
    throw new Error(`Failed to update ${filePath}: pattern not found.`);
  }

  writeFileSync(filePath, updated, 'utf-8');
}
