export function jsifyUint8Array(uint8Array: Uint8Array, name: string): string {
  // Convert the Uint8Array to a string representation
  const uint8ArrayString = JSON.stringify(Array.from(uint8Array))

  return `export const ${name} = new Uint8Array(${uint8ArrayString});`
}
