// https://www.typescriptlang.org/tsconfig/#high-level-libraries
export const allOptions = [
  { module: 'commonjs', moduleResolution: 'Node' },
  { module: 'ES2015', moduleResolution: 'Node' },
  { module: 'ES2020', moduleResolution: 'Node' },
  { module: 'ES2022', moduleResolution: 'Node' },
  { module: 'ESNext', moduleResolution: 'Node' },

  { module: 'Node16', moduleResolution: 'Node16' },
  { module: 'NodeNext', moduleResolution: 'Node16' },

  { module: 'Node16', moduleResolution: 'NodeNext' },
  { module: 'NodeNext', moduleResolution: 'NodeNext' },

  { module: 'ES2015', moduleResolution: 'Bundler' },
  { module: 'ES2020', moduleResolution: 'Bundler' },
  { module: 'ES2022', moduleResolution: 'Bundler' },
  { module: 'ESNext', moduleResolution: 'Bundler' },
]
