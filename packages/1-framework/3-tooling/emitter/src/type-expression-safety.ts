export function isSafeTypeExpression(expr: string): boolean {
  return !/import\s*\(|require\s*\(|declare\s|export\s|eval\s*\(/.test(expr);
}
