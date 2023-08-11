import Arg from 'arg'
import dedent from 'strip-indent'

/**
 * format
 */
export function format(input = ''): string {
  return dedent(input).trimRight() + '\n'
}

/**
 * Wrap arg to return an error instead of throwing
 */
export function arg<T extends Arg.Spec>(
  argv: string[],
  spec: T,
  stopAtPositional = true,
  permissive = false,
): Arg.Result<T> | Error {
  try {
    return Arg(spec, { argv, stopAtPositional, permissive })
  } catch (e: any) {
    return e
  }
}

/**
 * Check if result is an error
 */
export function isError(result: any): result is Error {
  return result instanceof Error
}
