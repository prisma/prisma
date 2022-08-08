import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
      previewFeatures: '"fullTextSearch"',
      index: '',
      andQuery: 'John & Smith',
      orQuery: 'John | April',
      notQuery: '(John | April) & !Smith',
      noResultsQuery: 'April & Smith',
      badQuery: 'John Smith',
    },
    {
      provider: 'mysql',
      previewFeatures: '"fullTextSearch", "fullTextIndex"',
      index: `
      @@fulltext([name])
      @@fulltext([name, email])
      @@fulltext([email])
      `,
      andQuery: '+John +Smith',
      orQuery: 'John April',
      notQuery: 'John -Smith April',
      noResultsQuery: '+April +Smith',
      badQuery: 'John <--> Smith',
    },
  ],
])
