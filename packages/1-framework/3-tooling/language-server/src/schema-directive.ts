const PRISMA_8_DIRECTIVE = /^\s*\/\/ *use +prisma-8 *(?!\S)/;

export function isPrismaNextSchema(text: string): boolean {
  return PRISMA_8_DIRECTIVE.test(text);
}
