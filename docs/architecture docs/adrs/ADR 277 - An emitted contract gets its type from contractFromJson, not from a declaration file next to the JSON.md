# ADR 277 — An emitted contract gets its type from `contractFromJson`, not from a declaration file next to the JSON

**Status:** Proposed
**Date:** 2026-10-19
**Domain:** Contract emission, Adapters / Targets
**Builds on:** [ADR 274 — A client takes a typed contract value, so every other option is inferred](ADR%20274%20-%20A%20client%20takes%20a%20typed%20contract%20value%2C%20so%20every%20other%20option%20is%20inferred.md), [ADR 159 — Definition-only contracts and type-only codec-operation maps](ADR%20159%20-%20Definition-only%20contracts%20and%20type-only%20codec-operation%20maps.md)

---

## At a glance

An application gives its emitted contract its type in one visible call:

```ts
// src/prisma/db.ts
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const contract = contractFromJson<Contract>(contractJson);
export const db = postgres({ contract, url: process.env['DATABASE_URL']! });
```

The emitter does not write a declaration file that types `contract.json` itself, so this does not work:

```ts
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres({ contract: contractJson }); // type error: the import has the JSON's own type, not Contract
```

## Decision

1. **`contractFromJson<Contract>(json)` is the one way an application gives an emitted contract its type.** The type is attached at the moment the JSON is validated.
2. **The emitter writes `contract.json` and `contract.d.ts` only.** It does not write `contract.d.json.ts`, and Prisma 8 does not require `allowArbitraryExtensions` or any other compiler setting in an application's `tsconfig.json`.

## Why

TypeScript can type a JSON import from a declaration file next to it. With `allowArbitraryExtensions` set, an import of `./contract.json` resolves to `contract.d.json.ts` when that file exists:

```ts
// contract.d.json.ts, written by the emitter
import type { Contract } from './contract.d';
declare const contract: Contract;
export = contract;
```

The import is then typed as `Contract`, and `postgres({ contract: contractJson, collections })` infers both the contract type and the collection classes with no extra call. It also ties each JSON file to its own type, so an application with two contracts cannot pair a type with the wrong file. This works with the demo application's real contract, at type-check time, under tsx and in a Vite build. We still do not use it, for the reasons below.

### It needs a compiler setting we do not control

Every application must turn on `allowArbitraryExtensions`. Without it, TypeScript stops with TS6263 ("was resolved to `contract.d.json.ts`, but `--allowArbitraryExtensions` is not set"). The error is clear, but it becomes a setup step in every new project and every framework guide.

Many applications do not own their `tsconfig.json` outright. Frameworks such as Next.js, Nuxt, SvelteKit and Astro generate it or have it extend their own, and monorepos share one base config. Each of these needs its own instructions.

### It fails under `nodenext`

Under `moduleResolution: nodenext`, which TypeScript recommends for Node servers and libraries, a default import of a JSON module needs the declaration file to use `export =`. TypeScript accepts `export =` in an ES module declaration file only when `skipLibCheck` is on (TS1203 otherwise). A project that checks its declaration files would get an error in a file it did not write.

### The type would describe a value the JSON is not

At run time an imported `contract.json` is raw JSON that nothing has validated. A declaration file would type it as the validated `Contract`. A client validates it before use, but any other code that reads the import trusts a type nothing has checked. `contractFromJson` attaches the type to the value it has just validated, so the type and the check happen in the same place.

### It is less visible

A reader of `db.ts` cannot see why `contractJson` has its type: the type comes from a file that appears nowhere in the code. `contractFromJson<Contract>(contractJson)` says where the type comes from, and it can be searched for.

### It asks more of the toolchain

Every tool that type-checks the application would have to resolve `.d.json.ts` files the same way TypeScript does, and the emitter would write a third generated file into the application's source tree.

## Consequences

- **An application writes one call, `contractFromJson<Contract>(contractJson)`,** and every client after it infers its options (ADR 274).
- **Applications need no special compiler settings** beyond those the JSON import itself already requires (`resolveJsonModule`).
- **Pairing the type with the JSON stays the application's job.** `contractFromJson<ContractA>(contractBJson)` compiles, and nothing at run time can catch it: `contract.d.ts` carries the contract's hash only as a type, and types are erased before the code runs. This is the one benefit of a declaration file that this decision gives up.

## Alternatives considered

### Write `declare module './contract.json'` in `contract.d.ts`

This would type the import with no new file. TypeScript rejects it. An ambient module declaration cannot name a relative module (TS2436). Written as a module augmentation inside `contract.d.ts`, it fails because `./contract.json` resolves to a JSON file, which is not a module that can be augmented (TS2671).

### Emit `contract.d.json.ts` next to `contract.json`

This is the approach described under "Why" and rejected for the reasons given there.

### A pattern declaration such as `declare module '*/contract.json'`

TypeScript accepts a wildcard ambient declaration, but uses it only when the import does not resolve to a real file. With `resolveJsonModule` on, which a JSON import needs, the real file always wins and the declaration is ignored. With it off, every `contract.json` in the program would share one type, so an application with two contracts could not type both.

### Emit `contract.d.json.ts` only when a project opts in

The emitter could write the declaration file when a configuration option asks for it, for teams that have the compiler setting and want the shorter call. It would be a second way to type the same contract. It is not adopted now, and nothing in this decision rules it out later. It could never be the default, because the file breaks every project that lacks the setting.

### Generate a TypeScript module that exports the typed contract

Many libraries generate a small module such as `export const contract = …` with the type attached. This needs no compiler setting and no extra call. Prisma 8 does not generate executable code for a contract: the contract is data, emitted as `contract.json` with types in `contract.d.ts` (ADR 159), so this is out of scope.
