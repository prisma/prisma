# Migration `20190530165824`

## Changes

```diff
diff --git datamodel.mdl datamodel.mdl
migration last migration id..20190530165824
--- datamodel.dml
+++ datamodel.dml
@@ -1,0 +1,67 @@
+model Blog {
+  id: Int @id
+  name: String
+  viewCount: Int
+  posts: Post[]
+  authors: Author[]
+}
+
+model Author {
+  id: Int @id
+  name: String?
+  authors: Blog[]
+}         
+
+model Post {
+  id: Int @id
+  title: String
+  anotherText: String
+  tags: String[]
+  blog: Blog
+}
+
+model AnotherModel {
+  id: Int @id
+  title2: String
+  anotherText: String
+  anotherText2: String
+  anotherText3: String
+  tags: String[]
+}
+
+model AnotherModel1 {
+  id: Int @id
+  title2: String
+  anotherText: String
+  anotherText2: String
+  anotherText3: String
+  tags: String[]
+}
+
+model AnotherModel2 {
+  id: Int @id
+  title2: String
+  anotherText: String
+  anotherText2: String
+  anotherText3: String
+  tags: String[]
+}
+
+model AnotherModel3 {
+  id: Int @id
+  title2: String
+  anotherText: String
+  anotherText2: String
+  anotherText3: String
+  tags: String[]
+}
+
+model AnotherModel4 {
+
+  id: Int @id
+}
+
+model AnotherModel5 {
+
+  id: Int @id
+}
```

## Photon Usage

You can use a specific Photon built for this migration (20190530165824)
in your `before` or `after` migration script like this:

```ts
import Photon from '@generated/photon/20190530165824'

const photon = new Photon()

async function main() {
  const result = await photon.users()
  console.dir(result, { depth: null })
}

main()

```
