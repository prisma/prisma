# Exported types

When types from `@prisma/client/runtime` are used in third party type declaration (for example, extensions that are published to `npm`) we need to ensure that whole type tree is exported from the runtime too. Otherwise, non-exported type can be inlined at each instance they are used in declaration file. That in turn will either affect typechecking performance or simply crash TS compiler if inlined type is too big.

In order to ensure that does not happen, this directory is governed by strict set of rules, enforced by eslint:

- All types, declared within this directory must be exported.
- Files in this directory are allowed to import only files in the same directory (+ a set of selected third-party packages).
- `index.ts` must re-export everything from every other file in this directory.
