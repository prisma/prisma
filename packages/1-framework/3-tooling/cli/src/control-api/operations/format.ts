import { readFile, writeFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { loadConfig } from '@internal/config-loader';
import { type FormatOptions, format } from '@internal/psl-parser/format';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { CliStructuredError, errorRuntime, errorUnexpected } from '../../utils/cli-errors';

export interface FormatOperationOptions {
  readonly configPath?: string;
  readonly eol?: string;
}

export interface FormatOperationResult {
  readonly formatted: boolean;
  readonly path?: string;
}

export function resolveNewline(
  formatterNewline: 'LF' | 'CRLF' | undefined,
  eol: string,
): 'LF' | 'CRLF' {
  if (formatterNewline !== undefined) {
    return formatterNewline;
  }
  return eol === '\r\n' ? 'CRLF' : 'LF';
}

export async function executeFormat(
  options: FormatOperationOptions,
): Promise<Result<FormatOperationResult, CliStructuredError>> {
  const eol = options.eol ?? EOL;

  let config: Awaited<ReturnType<typeof loadConfig>>;
  try {
    config = await loadConfig(options.configPath);
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }
    return notOk(errorUnexpected(error instanceof Error ? error.message : String(error)));
  }

  const source = config.contract?.source;
  if (source?.format !== 'psl') {
    return ok({ formatted: false });
  }

  const inputPath = source.inputs?.[0];
  if (inputPath === undefined) {
    return ok({ formatted: false });
  }

  let contents: string;
  try {
    contents = await readFile(inputPath, 'utf-8');
  } catch (error) {
    return notOk(
      errorRuntime('Failed to read contract source file', {
        why: error instanceof Error ? error.message : String(error),
        fix: `Check that ${inputPath} exists and is readable.`,
      }),
    );
  }

  const formatOptions: FormatOptions = {
    indent: config.formatter?.indent ?? 2,
    newline: resolveNewline(config.formatter?.newline, eol),
  };

  let formatted: string;
  try {
    formatted = format(contents, formatOptions);
  } catch (error) {
    if (isStructuredError(error) && error.code === 'PSL.PARSE_FAILED') {
      return notOk(
        errorRuntime('Cannot format PSL with parse errors', {
          why: error.message,
          fix: 'Fix the parse errors in your schema and try again.',
          meta: { diagnostics: error.meta?.['diagnostics'] },
        }),
      );
    }
    return notOk(errorUnexpected(error instanceof Error ? error.message : String(error)));
  }

  try {
    await writeFile(inputPath, formatted, 'utf-8');
  } catch (error) {
    return notOk(
      errorRuntime('Failed to write formatted contract source file', {
        why: error instanceof Error ? error.message : String(error),
        fix: `Check that ${inputPath} is writable.`,
      }),
    );
  }

  return ok({ formatted: true, path: inputPath });
}
