import { createCollectionFor } from './collection-fixtures';

// Post-group take()/skip() require a prior orderBy() on the grouped
// collection — a database may return groups in any order, so "page 2 of the
// groups" is undefined without one. Mirrors the hasOrderBy gate cursor()
// uses at the root position (collection.ts:865-869).

const { collection } = createCollectionFor('Post');

const ordered = collection.groupBy('userId').orderBy((group) => group.userId.asc());
ordered.take(2);
ordered.skip(2);

const unordered = collection.groupBy('userId');
// @ts-expect-error take() requires a prior orderBy() on the grouped collection
unordered.take(2);
// @ts-expect-error skip() requires a prior orderBy() on the grouped collection
unordered.skip(2);
