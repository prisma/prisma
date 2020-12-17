import { DMMF } from '@prisma/generator-helper'
import { capitalize, lowerCase } from '../../runtime/utils/common'
import { getModelArgName } from '../utils'

export const TAB_SIZE = 2
export interface JSDocMethodBodyCtx {
  singular: string
  plural: string
  firstScalar: DMMF.Field | undefined
  method: string
  model: DMMF.Model
  action: DMMF.ModelAction | 'findOne'
  mapping: DMMF.ModelMapping
}
const Docs = {
  cursor: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}`,
  pagination: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}`,
  aggregations: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}`,
  distinct: `@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs`,
  sorting: `@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs`,
}
type JSDocsType = {
  [action in DMMF.ModelAction | 'findOne']: {
    body: (ctx: JSDocMethodBodyCtx) => string
    fields: {
      [field: string]: (singular: string, plural: string) => string
    }
  }
}
function addLinkToDocs(comment: string, docs: keyof typeof Docs) {
  return `${Docs[docs]}

${comment}`
}
const JSDocFields = {
  take: (singular, plural) =>
    addLinkToDocs(
      `Take \`±n\` ${plural} from the position of the cursor.`,
      'pagination',
    ),
  skip: (singular, plural) =>
    addLinkToDocs(`Skip the first \`n\` ${plural}.`, 'pagination'),
  count: (singular, plural) =>
    addLinkToDocs(`Count returned ${plural}`, 'aggregations'),
  avg: (singular, plural) =>
    addLinkToDocs(`Select which fields to average`, 'aggregations'),
  sum: (singular, plural) =>
    addLinkToDocs(`Select which fields to sum`, 'aggregations'),
  min: (singular, plural) =>
    addLinkToDocs(
      `Select which fields to find the minimum value`,
      'aggregations',
    ),
  max: (singular, plural) =>
    addLinkToDocs(
      `Select which fields to find the maximum value`,
      'aggregations',
    ),
  distinct: (singular, plural) =>
    addLinkToDocs(`Filter by unique combinations of ${plural}.`, 'distinct'),
  orderBy: (singular, plural) =>
    addLinkToDocs(`Determine the order of ${plural} to fetch.`, 'sorting'),
}
export const JSDocs: JSDocsType = {
  groupBy: {
    body: (ctx) => `Group By`,
    fields: {},
  },
  create: {
    body: (ctx) => `Create a ${ctx.singular}.
@param {${getModelArgName(
      ctx.model.name,
      ctx.action,
    )}} args - Arguments to create a ${ctx.singular}.
@example
// Create one ${ctx.singular}
const ${ctx.singular} = await ${ctx.method}({
  data: {
    // ... data to create a ${ctx.singular}
  }
})
`,
    fields: {
      data: (singular, plural) => `The data needed to create a ${singular}.`,
    },
  },
  findOne: {
    body: (ctx) =>
      `Find zero or one ${ctx.singular} that matches the filter.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to find a ${ctx.singular}
@deprecated This will be deprecated please use ${`prisma.${lowerCase(
        ctx.mapping.model,
      )}.findUnique`}
@example
// Get one ${ctx.singular}
const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
  where: {
    // ... provide filter here
  }
})`,
    fields: {
      where: (singular, plural) => `Filter, which ${singular} to fetch.`,
    },
  },
  findUnique: {
    body: (ctx) =>
      `Find zero or one ${ctx.singular} that matches the filter.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to find a ${ctx.singular}
@example
// Get one ${ctx.singular}
const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
  where: {
    // ... provide filter here
  }
})`,
    fields: {
      where: (singular, plural) => `Filter, which ${singular} to fetch.`,
    },
  },
  findFirst: {
    body: (ctx) =>
      `Find the first ${ctx.singular} that matches the filter.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to find a ${ctx.singular}
@example
// Get one ${ctx.singular}
const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
  where: {
    // ... provide filter here
  }
})`,
    fields: {
      where: (singular, plural) => `Filter, which ${singular} to fetch.`,
      orderBy: JSDocFields.orderBy,
      cursor: (singular, plural) =>
        addLinkToDocs(
          `Sets the position for searching for ${plural}.`,
          'cursor',
        ),
      take: JSDocFields.take,
      skip: JSDocFields.skip,
      distinct: JSDocFields.distinct,
    },
  },
  findMany: {
    body: (ctx) => {
      const onlySelect = ctx.firstScalar
        ? `\n// Only select the \`${ctx.firstScalar.name}\`
const ${lowerCase(ctx.mapping.model)}With${capitalize(
            ctx.firstScalar.name,
          )}Only = await ${ctx.method}({ select: { ${
            ctx.firstScalar.name
          }: true } })`
        : ''

      return `Find zero or more ${ctx.plural} that matches the filter.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}=} args - Arguments to filter and select certain fields only.
@example
// Get all ${ctx.plural}
const ${ctx.mapping.plural} = await ${ctx.method}()

// Get first 10 ${ctx.plural}
const ${ctx.mapping.plural} = await ${ctx.method}({ take: 10 })
${onlySelect}
`
    },
    fields: {
      where: (singular, plural) => `Filter, which ${plural} to fetch.`,
      orderBy: JSDocFields.orderBy,
      skip: JSDocFields.skip,
      cursor: (singular, plural) =>
        addLinkToDocs(`Sets the position for listing ${plural}.`, 'cursor'),
      take: JSDocFields.take,
    },
  },
  update: {
    body: (ctx) =>
      `Update one ${ctx.singular}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to update one ${ctx.singular}.
@example
// Update one ${ctx.singular}
const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
`,
    fields: {
      data: (singular, plural) => `The data needed to update a ${singular}.`,
      where: (singular, plural) => `Choose, which ${singular} to update.`,
    },
  },
  upsert: {
    body: (ctx) =>
      `Create or update one ${ctx.singular}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to update or create a ${ctx.singular}.
@example
// Update or create a ${ctx.singular}
const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
  create: {
    // ... data to create a ${ctx.singular}
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the ${ctx.singular} we want to update
  }
})`,
    fields: {
      where: (singular, plural) =>
        `The filter to search for the ${singular} to update in case it exists.`,
      create: (singular, plural) =>
        `In case the ${singular} found by the \`where\` argument doesn't exist, create a new ${singular} with this data.`,
      update: (singular, plural) =>
        `In case the ${singular} was found with the provided \`where\` argument, update it with this data.`,
    },
  },
  delete: {
    body: (ctx) =>
      `Delete a ${ctx.singular}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to delete one ${ctx.singular}.
@example
// Delete one ${ctx.singular}
const ${ctx.singular} = await ${ctx.method}({
  where: {
    // ... filter to delete one ${ctx.singular}
  }
})
`,
    fields: {
      where: (singular, plural) => `Filter which ${singular} to delete.`,
    },
  },
  aggregate: {
    body: (ctx) =>
      `Allows you to perform aggregations operations on a ${ctx.singular}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Select which aggregations you would like to apply and on what fields.
@example
// Ordered by age ascending
// Where email contains prisma.io
// Limited to the 10 users
const aggregations = await prisma.user.aggregate({
  avg: {
    age: true,
  },
  where: {
    email: {
      contains: "prisma.io",
    },
  },
  orderBy: {
    age: "asc",
  },
  take: 10,
})`,
    fields: {
      where: (singular, plural) => `Filter which ${singular} to aggregate.`,
      orderBy: JSDocFields.orderBy,
      cursor: (singular, plural) =>
        addLinkToDocs(`Sets the start position`, 'cursor'),
      take: JSDocFields.take,
      skip: JSDocFields.skip,
      count: JSDocFields.count,
      avg: JSDocFields.avg,
      sum: JSDocFields.sum,
      min: JSDocFields.min,
      max: JSDocFields.max,
    },
  },
  count: {
    body: (ctx) =>
      `Count the number of ${ctx.plural}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to filter ${ctx.plural} to count.
@example
// Count the number of ${ctx.plural}
const count = await ${ctx.method}({
  where: {
    // ... the filter for the ${ctx.plural} we want to count
  }
})`,
    fields: {},
  },
  updateMany: {
    body: (ctx) =>
      `Update zero or more ${ctx.plural}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to update one or more rows.
@example
// Update many ${ctx.plural}
const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
`,
    fields: {
      data: (singular, plural) => `The data used to update ${plural}.`,
      where: (singular, plural) => `Filter which ${plural} to update`,
    },
  },
  deleteMany: {
    body: (ctx) =>
      `Delete zero or more ${ctx.plural}.
@param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Arguments to filter ${ctx.plural} to delete.
@example
// Delete a few ${ctx.plural}
const { count } = await ${ctx.method}({
  where: {
    // ... provide filter here
  }
})
`,
    fields: {
      where: (singular, plural) => `Filter which ${plural} to delete`,
    },
  },
}
