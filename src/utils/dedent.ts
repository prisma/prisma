import strip from 'strip-indent'
export function dedent(str: string): string {
  console.log(str)
  return strip(str).trim()
}
