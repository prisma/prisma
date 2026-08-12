# Side-by-side SQL and Mongo contract examples

This fixture set keeps a comparable `User`/`Post` contract in both supported authoring forms:

- `contract.ts` for TypeScript contract authoring
- `contract.prisma` for PSL contract authoring
- `contract.json` for the emitted canonical artifact

Each family lives in its own directory:

- `postgres/`
- `mongo/`

The integration runner in `../side-by-side-contracts.test.ts` asserts that, for each family:

- the TypeScript-authored contract is valid
- the PSL-authored contract is valid
- both authoring forms normalize to the same contract IR
- both authoring forms emit the committed `contract.json`

It also checks that the two families stay structurally comparable at the domain level:

- the same aggregate roots (`users`, `posts`)
- the same `User.posts` and `Post.author` relation shape
- the same shared field names for the non-storage-specific fields
