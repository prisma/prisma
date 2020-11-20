import { DMMF } from '../../runtime/dmmf-types'
import {
  capitalize,
  lowerCase,
} from '../../runtime/utils/common'
import { getModelArgName, unique } from '../utils'

export function getMethodJSDocBody(
  action: DMMF.ModelAction | 'findOne',
  mapping: DMMF.ModelMapping,
  model: DMMF.Model,
): string {
  const singular = capitalize(mapping.model)
  const plural = capitalize(mapping.plural)
  const firstScalar = model.fields.find((f) => f.kind === 'scalar')
  const method = `prisma.${lowerCase(mapping.model)}.${action}`

  switch (action) {
    case DMMF.ModelAction.create:
      return `Create a ${singular}.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to create a ${singular}.
@example
// Create one ${singular}
const ${singular} = await ${method}({
  data: {
    // ... data to create a ${singular}
  }
})
`
    case DMMF.ModelAction.delete:
      return `Delete a ${singular}.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to delete one ${singular}.
@example
// Delete one ${singular}
const ${singular} = await ${method}({
  where: {
    // ... filter to delete one ${singular}
  }
})
`
    case DMMF.ModelAction.deleteMany:
      return `Delete zero or more ${plural}.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to filter ${plural} to delete.
@example
// Delete a few ${plural}
const { count } = await ${method}({
  where: {
    // ... provide filter here
  }
})
`
    case DMMF.ModelAction.findMany: {
      const onlySelect = firstScalar
        ? `\n// Only select the \`${firstScalar.name}\`
const ${lowerCase(mapping.model)}With${capitalize(
          firstScalar.name,
        )}Only = await ${method}({ select: { ${firstScalar.name}: true } })`
        : ''

      return `Find zero or more ${plural} that matches the filter.
@param {${getModelArgName(
        model.name,
        action,
      )}=} args - Arguments to filter and select certain fields only.
@example
// Get all ${plural}
const ${mapping.plural} = await ${method}()

// Get first 10 ${plural}
const ${mapping.plural} = await ${method}({ take: 10 })
${onlySelect}
`
    }
    case DMMF.ModelAction.findUnique: {
      return `Find zero or one ${singular} that matches the filter.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to find a ${singular}
@example
// Get one ${singular}
const ${lowerCase(mapping.model)} = await ${method}({
  where: {
    // ... provide filter here
  }
})`
    }
    case 'findOne': {
      return `Find zero or one ${singular} that matches the filter.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to find a ${singular}
@deprecated This will be deprecated please use ${`prisma.${lowerCase(mapping.model)}.findUnique`}
@example
// Get one ${singular}
const ${lowerCase(mapping.model)} = await ${method}({
  where: {
    // ... provide filter here
  }
})`
    }
    case DMMF.ModelAction.findFirst: {
      return `Find the first ${singular} that matches the filter.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to find a ${singular}
@example
// Get one ${singular}
const ${lowerCase(mapping.model)} = await ${method}({
  where: {
    // ... provide filter here
  }
})`
    }
    case DMMF.ModelAction.update:
      return `Update one ${singular}.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to update one ${singular}.
@example
// Update one ${singular}
const ${lowerCase(mapping.model)} = await ${method}({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
`

    case DMMF.ModelAction.updateMany:
      return `Update zero or more ${plural}.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to update one or more rows.
@example
// Update many ${plural}
const ${lowerCase(mapping.model)} = await ${method}({
  where: {
    // ... provide filter here
  },
  data: {
    // ... provide data here
  }
})
`
    case DMMF.ModelAction.upsert:
      return `Create or update one ${singular}.
@param {${getModelArgName(
        model.name,
        action,
      )}} args - Arguments to update or create a ${singular}.
@example
// Update or create a ${singular}
const ${lowerCase(mapping.model)} = await ${method}({
  create: {
    // ... data to create a ${singular}
  },
  update: {
    // ... in case it already exists, update
  },
  where: {
    // ... the filter for the ${singular} we want to update
  }
})`
  }
}

export function getMethodJSDoc(
  action: DMMF.ModelAction,
  mapping: DMMF.ModelMapping,
  model: DMMF.Model,
): string {
  return wrapComment(getMethodJSDocBody(action, mapping, model))
}

export function wrapComment(str: string): string {
  return `/**\n${str
    .split('\n')
    .map((l) => ' * ' + l)
    .join('\n')}\n**/`
}

/* eslint-disable @typescript-eslint/no-unused-vars */
export const topLevelArgsJsDocs = {
  findOne: {
    where: (singular, plural): string => `Filter, which ${singular} to fetch.`,
  },
  findUnique: {
    where: (singular, plural): string => `Filter, which ${singular} to fetch.`,
  },
  findFirst: {
    where: (singular, plural): string => `Filter, which ${singular} to fetch.`,
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
}
/* eslint-enable @typescript-eslint/no-unused-vars */

export function escapeJson(str: string): string {
  return str
    .replace(/\\n/g, '\\\\n')
    .replace(/\\r/g, '\\\\r')
    .replace(/\\t/g, '\\\\t')
}

export class ExportCollector {
  symbols: string[] = []
  addSymbol(symbol: string) {
    this.symbols.push(symbol)
  }
  getSymbols() {
    return unique(this.symbols)
  }
}