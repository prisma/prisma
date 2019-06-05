import { highlightDatamodel } from "../../cli/highlight/highlight";
import { printDatamodelDiff } from "../printDatamodelDiff";

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
}`;

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
}`;

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

test("basic diff", () => {
  expect(printDatamodelDiff(datamodelA, datamodelB)).toMatchInlineSnapshot(`
    "[38;5;31mmodel Blog[39m [38;5;109m{[39m
      id[38;5;109m: Int[39m [38;5;31m@primary[39m
    [91m  [39m[1;31;48;5;52mname[m[91m: String[39m
    [92m  [39m[1;32;48;5;22mthis[m[92m: String[39m
    viewCount[38;5;109m: Int[39m
      posts[38;5;109m: Post[39m[]
      authors[38;5;109m: Author[39m[]
    [38;5;109m}[39m"
  `);
});
