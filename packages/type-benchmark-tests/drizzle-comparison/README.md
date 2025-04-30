# drizzle-comparison

Based on [Drizzle's Northwind benchmarks](https://github.com/drizzle-team/drizzle-northwind-benchmarks-pg), stripped down to only the typed expressions.

## Conclusions

Prisma is able to evaluate its generated client types about twice as efficiently as Drizzle can evaluate its corresponding schemas.

Prisma is able to check query interactions about 10x as efficiently as Drizzle.

Critically, this doesn't necessarily tell us which types are better optimized since Drizzle schemas are inferred directly from `.ts` whereas Prisma client types are dynamically generated via `prisma generate`.

Each approach has its own trade offs, but this data confirms that an _extremely_ significant benefit of a typegen step is the type performance ceiling. If your schema is large and complex, you will get much further with Prisma before running up against the boundaries of TypeScript.

## Schemas

### Type Instantiations

| File               | Drizzle | Prisma | diff (count) | diff (%) |
| ------------------ | ------- | ------ | ------------ | -------- |
| \*.schema.bench.ts | 54109   | 31870  | -22239       | -41.10%  |

### Check Time

| File               | Drizzle | Prisma | diff (ms) | diff (%) |
| ------------------ | ------- | ------ | --------- | -------- |
| \*.schema.bench.ts | 259ms   | 117ms  | -623      | -67.64%  |

## Queries

### Type Instantiations

| Label              | Drizzle     | Prisma     | diff (count) | diff (%)    |
| ------------------ | ----------- | ---------- | ------------ | ----------- |
| Customers: getInfo | 921         | 298        | -623         | -67.64%     |
| Customers: search  | 856         | 177        | -679         | -79.32%     |
| Employees: getInfo | 22461       | 382        | -22079       | -98.30%     |
| Suppliers: getInfo | 881         | 292        | -589         | -66.86%     |
| Products: getInfo  | 2430        | 340        | -2090        | -86.01%     |
| Products: search   | 782         | 177        | -605         | -77.37%     |
| Orders: getAll     | 2890        | 168        | -2722        | -94.19%     |
| Orders: getById    | 3242        | 252        | -2990        | -92.22%     |
| Orders: getInfo    | 3941        | 250        | -3691        | -93.66%     |
| **Average**        | **4267.11** | **259.56** | **-4007.56** | **-83.95%** |

### Check Time

| File              | Drizzle | Prisma | diff (ms) | diff (%) |
| ----------------- | ------- | ------ | --------- | -------- |
| \*.query.bench.ts | 346ms   | 19ms   | 327ms     | -95%     |
