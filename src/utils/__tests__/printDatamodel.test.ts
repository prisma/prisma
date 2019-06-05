import { printDatamodelDiff } from "../printDatamodelDiff";

const datamodelA = `model Blog {
  id: Int @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}

model Author {
  id: Int @id
  name: String?
  authors: Blog[]
}

model Post {
  id: Int @id
  title: String
  anotherText: String
  text: String
  tags: String[]
  blog: Blog
}`;

const datamodelB = `model Blog {
  id: Int @id
  this: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}

model Author {
  id: Int @id
  name: String?
  authors: Blog[]
}

model Post {
  id: Int @id
  title: String
  anotherText: String
  text: String
  tags: String[]
  blog: Blog
}`;

test("basic diff", () => {
  const diff = printDatamodelDiff(datamodelA, datamodelB);
  console.log(diff);
  expect(diff).toMatchInlineSnapshot(`
                                            "[38;5;31mmodel Blog[39m [38;5;109m{[39m
                                              id[38;5;109m: Int[39m [38;5;31m@id[39m
                                            [91m  [39m[1;31;48;5;52mname[m[91m: String[39m
                                            [92m  [39m[1;32;48;5;22mthis[m[92m: String[39m
                                              viewCount[38;5;109m: Int[39m
                                              posts[38;5;109m: Post[39m[]
                                              authors[38;5;109m: Author[39m[]
                                            [38;5;109m}[39m"
                      `);
});

test("rename field", () => {
  const before = `model Blog {
  id: Int @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}`;

  const after = `model Blog {
  id: String @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}`;

  const diff = printDatamodelDiff(before, after);
  console.log(diff);
  expect(diff).toMatchInlineSnapshot(`
                                                "[38;5;31mmodel Blog[39m [38;5;109m{[39m
                                                [91m  id: [39m[1;31;48;5;52mInt[m[91m @id[39m
                                                [92m  id: [39m[1;32;48;5;22mString[m[92m @id[39m
                                                  name[38;5;109m: String[39m
                                                  viewCount[38;5;109m: Int[39m
                                                  posts[38;5;109m: Post[39m[]
                                                  authors[38;5;109m: Author[39m[]
                                                [38;5;109m}[39m"
                        `);
});

test("add model", () => {
  const before = `model Blog {
  id: Int @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}`;

  const after = `model Blog {
  id: String @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}

model Blog2 {
  id: String @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}
`;

  const diff = printDatamodelDiff(before, after);
  console.log(diff);
  expect(diff).toMatchInlineSnapshot(`
    "[38;5;31mmodel Blog[39m [38;5;109m{[39m
    [91m  id: [39m[1;31;48;5;52mInt[m[91m @id[39m
    [92m  id: [39m[1;32;48;5;22mString[m[92m @id[39m
      name[38;5;109m: String[39m
      viewCount[38;5;109m: Int[39m
      posts[38;5;109m: Post[39m[]
      authors[38;5;109m: Author[39m[]
    [38;5;109m}[39m
    [92m[39m
    [92mmodel Blog2 {[39m
    [92m  id: String @id[39m
    [92m  name: String[39m
    [92m  viewCount: Int[39m
    [92m  posts: Post[][39m
    [92m  authors: Author[][39m
    [92m}[39m"
  `);
});

test("copy model", () => {
  const datamodelC = `model Blog {
  id: Int @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}

model Author {
  id: Int @id
  name: String?
  authors: Blog[]
}

model Post {
  id: Int @id
  title: String
  anotherText: String
  text: String
  tags: String[]
  blog: Blog
}

model Blog2 {
  id: Int @id
  name: String
  viewCount: Int
  posts: Post[]
  authors: Author[]
}
`;
  const diff = printDatamodelDiff(datamodelA, datamodelC);
  console.log(diff);
  expect(diff).toMatchInlineSnapshot(`
        "[92m[39m
        [92mmodel Blog2 {[39m
        [92m  id: Int @id[39m
        [92m  name: String[39m
        [92m  viewCount: Int[39m
        [92m  posts: Post[][39m
        [92m  authors: Author[][39m
        [92m}[39m"
    `);
});
