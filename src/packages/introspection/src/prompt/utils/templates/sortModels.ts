import { DMMF } from '@prisma/generator-helper'

const modelOrder = [
  'User',
  'Player',
  'Customer',
  'Product',
  'Order',
  'Article',
  'Post',
  'Message',
]

export function sortModels(models: DMMF.Model[]): DMMF.Model[] {
  return models.sort((a, b) => {
    if (modelOrder.includes(a.name) && modelOrder.includes(b.name)) {
      const aIndex = modelOrder.indexOf(a.name)
      const bIndex = modelOrder.indexOf(b.name)
      return aIndex < bIndex ? -1 : 1
    }

    if (modelOrder.includes(a.name)) {
      return -1
    }

    if (modelOrder.includes(b.name)) {
      return 1
    }

    return a.name < b.name ? -1 : 1
  })
}
