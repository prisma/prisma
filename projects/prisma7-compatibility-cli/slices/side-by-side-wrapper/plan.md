## Dispatch plan

### Dispatch 1: runnable identity-aware wrapper

- **Outcome:** The default Prisma CLI resolves its existing identity unchanged, while a buildable `prisma7` binary selects the private one-shot identity and delegates all arguments, completion dispatch, exit behavior, and subprocess re-entry to its declared Prisma CLI dependency.
- **Builds on:** The slice spec's chosen identity-transport and dependency-wrapper design.
- **Hands to:** A runnable unpublished wrapper with a frozen identity contract, no copied CLI implementation, and focused tests proving default Prisma and wrapped Prisma select the intended identities.
- **Focus:** Identity resolution lifecycle, marker consumption, executable delegation, package skeleton/build, argument and completion forwarding, and default-behavior regression coverage. Public root/config parity and packed-manifest proof belong to dispatch 2.

### Dispatch 2: forwarded package surface and packed resolution proof

- **Outcome:** `prisma7`, `prisma7/config`, and `prisma7/package.json` expose the intended forwarded runtime/type contracts, and a packed artifact records the exact matching Prisma dependency and resolves it correctly beside a different direct root Prisma version.
- **Builds on:** Dispatch 1's runnable wrapper and frozen identity contract.
- **Hands to:** A complete unpublished slice artifact satisfying the wrapper package contract, ready for exhaustive identity propagation in the next project slice.
- **Focus:** Export map and files manifest, root/config runtime and type forwarding, exact workspace-to-packed dependency semantics, package inspection, and local side-by-side resolution tests. Exhaustive CLI wording and all publication automation remain out of scope.

### Dispatch 3: infer identity from the executed binary

- **Outcome:** CLI identity is derived solely from the normalized stem of `process.argv[1]`; the distinctive `prisma7.js` target selects `prisma7` across supported package-manager launch forms, while ordinary Prisma and unsupported caller-defined entrypoints default to `prisma`.
- **Builds on:** Dispatch 2's complete wrapper package and the cross-package-manager `/tmp` probe that falsified the marker/global-symbol design.
- **Hands to:** A simpler reviewer-verified wrapper with no identity environment marker, cleanup, global symbol, package metadata lookup, or cross-bundle mutable state, ready for the next project slice.
- **Focus:** Replace marker/global identity transport, give the wrapper a distinctive executable target, update emitted/forwarding/packed contract tests, and regression-pin normalized shim-vs-target names. Exhaustive user-facing identity propagation remains the next slice.
