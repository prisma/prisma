import { DMMF } from '@prisma/generator-helper'
import { capitalize, lowerCase } from '../../runtime/utils/common'
import { getModelArgName } from '../utils'

export const TAB_SIZE = 2

export const JsDocsArgs = {
  findOne: {
    where: (singular, plural): string => `Filter, which ${singular} to fetch.`,
  },
  findUnique: {
    where: (singular, plural): string => `Filter, which ${singular} to fetch.`,
  },
  findFirst: {
    where: (singular, plural): string => `Filter, which ${singular} to fetch.`,
    orderBy: (singular, plural): string =>
      `Determine the order of ${plural} to fetch.`,
    cursor: (singular, plural): string =>
      `Sets the position for searching for ${plural}.`,
    take: (singular, plural): string =>
      `The number of ${plural} to search. If negative number, it will take ${plural} before the \`cursor\`.`,
    skip: (singular, plural): string => `Skip the first \`n\` ${plural}.`,
    distinct: (singular, plural): string =>
      `Filter by unique combinations of ${plural}.`,
  },
  findMany: {
    where: (singular, plural): string => `Filter, which ${plural} to fetch.`,
    orderBy: (singular, plural): string =>
      `Determine the order of the ${plural} to fetch.`,
    skip: (singular, plural): string => `Skip the first \`n\` ${plural}.`,
    cursor: (singular, plural): string =>
      `Sets the position for listing ${plural}.`,
    take: (singular, plural): string =>
      `The number of ${plural} to fetch. If negative number, it will take ${plural} before the \`cursor\`.`,
  },
  create: {
    data: (singular, plural): string =>
      `The data needed to create a ${singular}.`,
  },
  update: {
    data: (singular, plural): string =>
      `The data needed to update a ${singular}.`,
    where: (singular, plural): string => `Choose, which ${singular} to update.`,
  },
  upsert: {
    where: (singular, plural): string =>
      `The filter to search for the ${singular} to update in case it exists.`,
    create: (singular, plural): string =>
      `In case the ${singular} found by the \`where\` argument doesn't exist, create a new ${singular} with this data.`,
    update: (singular, plural): string =>
      `In case the ${singular} was found with the provided \`where\` argument, update it with this data.`,
  },
  delete: {
    where: (singular, plural): string => `Filter which ${singular} to delete.`,
  },
  aggregate: {
    where: (singular, plural): string =>
      `Filter which ${singular} to group by.`,
  },
  count: {},
  updateMany: {
    data: (singular, plural) => `The data used to update ${plural}.`,
    where: (singular, plural) => `Filter which ${plural} to update`,
  },
  deleteMany: {
    where: (singular, plural) => `Filter which ${plural} to aggregate`,
    orderBy: (singular, plural) => ``,
    cursor: (singular, plural) => ``,
    take: (singular, plural) => ``,
    skip: (singular, plural) => ``,
    distinct: (singular, plural) => ``,
    avg: (singular, plural) => ``,
    sum: (singular, plural) => ``,
    min: (singular, plural) => ``,
    max: (singular, plural) => ``,
  },
}

export interface JSDocMethodBodyCtx {
  singular: string
  plural: string
  firstScalar: DMMF.Field | undefined
  method: string
  model: DMMF.Model
  action: DMMF.ModelAction | 'findOne'
  mapping: DMMF.ModelMapping
}
export const JSDocMethodBodies = {
  [DMMF.ModelAction.create]: (ctx: JSDocMethodBodyCtx) =>
    `Create a ${ctx.singular}.
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
  [DMMF.ModelAction.delete]: (ctx: JSDocMethodBodyCtx) =>
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
  [DMMF.ModelAction.deleteMany]: (ctx: JSDocMethodBodyCtx) =>
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
  [DMMF.ModelAction.findMany]: (ctx: JSDocMethodBodyCtx) => {
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
  [DMMF.ModelAction.findUnique]: (ctx: JSDocMethodBodyCtx) =>
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
  findOne: (ctx: JSDocMethodBodyCtx) =>
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

  [DMMF.ModelAction.findFirst]: (ctx: JSDocMethodBodyCtx) =>
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

  [DMMF.ModelAction.update]: (ctx: JSDocMethodBodyCtx) =>
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

  [DMMF.ModelAction.updateMany]: (ctx: JSDocMethodBodyCtx) =>
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
  [DMMF.ModelAction.upsert]: (ctx: JSDocMethodBodyCtx) =>
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
  [DMMF.ModelAction.count]: (
    ctx: JSDocMethodBodyCtx,
  ) => `Count the number of ${ctx.plural}.
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
  [DMMF.ModelAction.aggregate]: (ctx: JSDocMethodBodyCtx) =>
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
}
