/**
 * Remove duplicates from object array based on item property.
 * @param array The array to filter
 * @param properties The property to filter
 * @returns The filtered array
 */
export function filterDuplicatesOnProperty<T>(array: T[], property: keyof T): T[] {
  return array.reduce((previous: T[], current) => {
    if (!previous.some((object) => object[property] === current[property])) {
      previous.push(current)
    }
    return previous
  }, [])
}

/**
 * Remove duplicates from array of objects based on properties.
 * @param array The array to filter
 * @param properties The properties to filter
 * @returns The filtered array
 */
export function filterDuplicatesOnProperties<T extends object>(array: T[], ...properties: (keyof T)[]): T[] {
  for (const property of properties) {
    array = filterDuplicatesOnProperty(array, property)
  }
  return array
}
