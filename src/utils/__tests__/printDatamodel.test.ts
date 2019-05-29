import { highlightDatamodel } from '../highlightDatamodel'
import { printDatamodelDiff } from '../printDatamodelDiff'

const datamodelA = `model Blog {
  id: Int @primary
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}

model Author {
  id: Int @primary
  name: String?
  authors: Blog[]
}

model Post {
  id: Int @primary
  title: String
  anotherText: String
  text: String
  tags: String[]
  blog: Blog
}`

const datamodelB = `model Blog {
  id: Int @primary
  this: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}

model Author {
  id: Int @primary
  name: String?
  authors: Blog[]
}

model Post {
  id: Int @primary
  title: String
  anotherText: String
  text: String
  tags: String[]
  blog: Blog
}`

// const datamodelB = `model Blog {
//   id: Int @primary
//   name: String
//   viewCount: Int
//   hi: String
// }

// model Author {
//   id: Int @primary
//   name: String?
// }

// model Post {
//   id: Int @primary
//   title: String
//   anotherText: String
//   text: String
//   tags: String[]
//   blog: Blog
// }`

console.clear()
console.log()
console.log(printDatamodelDiff(datamodelA, datamodelB))
