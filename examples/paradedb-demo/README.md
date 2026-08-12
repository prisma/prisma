# paradedb-demo

End-to-end demo of `@internal/extension-paradedb` against a live ParadeDB server in Docker.

Exercises:

- `paradeDbMatch(col, query)` / `paradeDbMatchAny` / `paradeDbMatchAll` / `paradeDbTerm` / `paradeDbPhrase` — the five match-mode operators (`@@@` / `|||` / `&&&` / `===` / `###`).
- `paradeDbScore(keyCol)` — BM25 relevance score (`pdb.score`).
- `paradeDbFuzzy` / `paradeDbBoost` / `paradeDbConst` / `paradeDbSlop` — typmod casts (`'q'::pdb.fuzzy(N)` etc.); compose into match operators.
- `paradeDbProximity(start).within(distance, term, { ordered? })…` — chained proximity (`##` / `##>`); composes through `paradeDbMatch`.
- Automatic `CREATE EXTENSION pg_search` via the extension's contract-space baseline migration.
- Automatic `CREATE INDEX ... USING bm25 (...) WITH (key_field='...')` via upstream's index-type registry.

## Run it

```bash
cp .env.example .env
pnpm docker:up
pnpm emit
pnpm db:init
pnpm seed
pnpm start -- match 'headphones'
pnpm start -- top 'laptop' 5
pnpm start -- fuzzy 'laptp' 2
pnpm start -- proximity 'wireless' 'keyboard' 3
pnpm start -- proximity-chain 'cooling' '>1' 'fan' '>1' 'and'
pnpm start -- chain-demo
pnpm start -- mode-tour
pnpm start -- cast-demo
```

`pnpm db:init` produces the BM25 index directly from the `constraints.index([...], { type: 'bm25', options: { key_field: 'id' } })` declaration in `prisma/contract.ts`.

Teardown:

```bash
pnpm docker:down
```
