import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    <%_ for (const provider of providers) { _%>
    {
      provider: '<%= provider %>',
    },
    <%_ } _%>
  ],
])