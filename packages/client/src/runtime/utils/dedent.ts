import strip from 'strip-indent'
export function dedent(str: string): string {
  return strip(str)
}
