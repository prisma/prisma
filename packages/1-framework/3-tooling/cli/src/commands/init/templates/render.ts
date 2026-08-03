import { readFileSync } from 'node:fs';
import { InternalError } from '@internal/utils/internal-error';
import { join } from 'pathe';

export function renderTemplate(
  templateFile: string,
  variableNames: readonly string[],
  vars: Record<string, string>,
): string {
  const templatePath = join(import.meta.dirname, templateFile);
  const raw = readFileSync(templatePath, 'utf-8');
  let result = raw;
  for (const key of variableNames) {
    const value = vars[key];
    if (value === undefined) {
      throw new InternalError(`Template variable '${key}' is not defined`);
    }
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
