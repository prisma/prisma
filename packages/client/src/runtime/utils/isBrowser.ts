export function isBrowser(): boolean {
  // @ts-ignore - window is not defined
  return typeof window !== 'undefined'
}
