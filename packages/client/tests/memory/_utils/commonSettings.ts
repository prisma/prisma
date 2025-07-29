// NOTE: Increased warmup iterations due to Node.js 23 changed JIT behavior.
// It seems to take longer to create optimized code which consumes additional memory.
// Our tests incorrectly report this additional memory as leakage.
// See: https://github.com/prisma/prisma/pull/25971#issuecomment-2572448506
// TODO: Revisit this once Node.js 24 LTS is out.
export const WARMUP_ITERATIONS = 1500
