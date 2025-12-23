# Baseline benchmark results

Baseline benchmark results at the beginning of the performance optimization project.

Obtained on Apple M1 Pro with Node.js 24.11.1 on 2025-12-22.

## `data-mapper.bench.ts`

```
dataMapper: 10 rows x 155,396 ops/sec ±0.43% (86 runs sampled)
dataMapper: 50 rows x 24,419 ops/sec ±1.98% (68 runs sampled)
dataMapper: 100 rows x 12,321 ops/sec ±2.37% (68 runs sampled)
dataMapper: nested 5 users x 3 posts x 156,010 ops/sec ±0.30% (98 runs sampled)
dataMapper: nested 10 users x 5 posts x 52,478 ops/sec ±0.20% (95 runs sampled)
dataMapper: nested 20 users x 10 posts x 14,186 ops/sec ±0.19% (99 runs sampled)
```

## `interpreter.bench.ts`

```
interpreter: simple select x 221,216 ops/sec ±1.13% (86 runs sampled)
interpreter: findUnique x 337,297 ops/sec ±1.69% (85 runs sampled)
interpreter: join (1:N) x 189,671 ops/sec ±1.81% (88 runs sampled)
interpreter: sequence x 284,629 ops/sec ±1.76% (84 runs sampled)
interpreter: deep nested join x 34,935 ops/sec ±0.44% (87 runs sampled)
```

## `serializer.bench.ts`

```
serializer: 10 rows x 3 cols x 2,432,520 ops/sec ±0.35% (97 runs sampled)
serializer: 50 rows x 8 cols x 195,410 ops/sec ±0.31% (97 runs sampled)
serializer: 100 rows x 8 cols x 97,447 ops/sec ±0.27% (95 runs sampled)
```

## `compilation.bench.ts`

```
compile findUnique simple x 11,065 ops/sec ±0.62% (88 runs sampled)
compile findUnique with select x 16,910 ops/sec ±0.34% (93 runs sampled)
compile findMany simple x 14,249 ops/sec ±0.37% (92 runs sampled)
compile findMany filtered x 8,129 ops/sec ±0.50% (93 runs sampled)
compile findMany complex where x 6,097 ops/sec ±0.61% (96 runs sampled)
compile findUnique with 1:1 include x 5,781 ops/sec ±0.53% (96 runs sampled)
compile findUnique with 1:N include x 5,477 ops/sec ±0.52% (98 runs sampled)
compile findMany nested includes x 3,113 ops/sec ±0.44% (97 runs sampled)
compile findMany deep nested x 2,098 ops/sec ±0.51% (94 runs sampled)
compile create simple x 8,920 ops/sec ±0.41% (95 runs sampled)
compile create nested x 3,407 ops/sec ±0.55% (92 runs sampled)
compile update simple x 8,712 ops/sec ±0.43% (97 runs sampled)
compile updateMany x 14,443 ops/sec ±0.48% (94 runs sampled)
compile upsert x 5,390 ops/sec ±0.59% (95 runs sampled)
compile delete simple x 11,916 ops/sec ±0.41% (97 runs sampled)
compile count x 13,231 ops/sec ±0.39% (98 runs sampled)
compile count filtered x 8,681 ops/sec ±1.35% (98 runs sampled)
compile aggregate x 8,781 ops/sec ±0.41% (95 runs sampled)
compile groupBy x 28,495 ops/sec ±0.33% (98 runs sampled)
compile blog post page x 2,176 ops/sec ±0.57% (96 runs sampled)
compile blog listing page x 4,714 ops/sec ±0.65% (92 runs sampled)
compile user profile page x 3,066 ops/sec ±0.55% (96 runs sampled)
compile order history x 4,860 ops/sec ±0.54% (97 runs sampled)
instantiate query compiler x 1,180 ops/sec ±1.03% (94 runs sampled)
```

## `query-performance.bench.ts`

```
findUnique by id x 5,870 ops/sec ±1.37% (82 runs sampled)
findFirst with simple where x 6,080 ops/sec ±0.98% (83 runs sampled)
findMany 10 records x 6,799 ops/sec ±0.76% (85 runs sampled)
findMany with orderBy x 5,911 ops/sec ±0.85% (86 runs sampled)
findMany with filter x 5,790 ops/sec ±0.70% (88 runs sampled)
findMany with pagination x 6,276 ops/sec ±0.71% (88 runs sampled)
findUnique with 1:1 include x 3,287 ops/sec ±0.95% (86 runs sampled)
findUnique with 1:N include x 2,905 ops/sec ±1.14% (81 runs sampled)
findUnique with nested includes x 1,569 ops/sec ±0.87% (86 runs sampled)
findMany with includes x 1,820 ops/sec ±0.87% (87 runs sampled)
findMany with select x 11,538 ops/sec ±0.65% (85 runs sampled)
findMany with nested select x 6,287 ops/sec ±0.84% (84 runs sampled)
findMany with OR filter x 4,386 ops/sec ±0.77% (87 runs sampled)
findMany with complex filters x 3,441 ops/sec ±1.05% (85 runs sampled)
findMany with contains filter x 4,528 ops/sec ±0.90% (87 runs sampled)
count all x 13,621 ops/sec ±0.86% (82 runs sampled)
count with filter x 9,690 ops/sec ±0.63% (86 runs sampled)
aggregate sum/avg x 9,291 ops/sec ±0.77% (85 runs sampled)
groupBy with count x 11,394 ops/sec ±1.09% (84 runs sampled)
create single record x 4,728 ops/sec ±0.90% (83 runs sampled)
create with nested x 2,604 ops/sec ±1.13% (81 runs sampled)
update single record x 5,120 ops/sec ±0.80% (85 runs sampled)
updateMany x 7,055 ops/sec ±0.79% (86 runs sampled)
transaction sequential x 2,478 ops/sec ±1.21% (85 runs sampled)
transaction batch x 2,036 ops/sec ±1.17% (85 runs sampled)
blog post page query x 1,124 ops/sec ±1.11% (85 runs sampled)
blog listing page query x 1,798 ops/sec ±0.95% (87 runs sampled)
user profile page query x 1,427 ops/sec ±1.04% (85 runs sampled)
order history query x 2,705 ops/sec ±1.16% (83 runs sampled)
product search query x 4,053 ops/sec ±1.06% (80 runs sampled)
```
