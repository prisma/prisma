# Migration `20190530104529`

## Changes

```diff
diff --git datamodel.mdl datamodel.mdl
migration last migration id..20190530104529
--- datamodel.dml
+++ datamodel.dml
@@ -1,0 +1,31 @@
+model Blog {
+  id: Int @id
+  name: String
+  viewCount: Int
+  posts: Post[]
+  authors3: Author[]
+}
+
+model Author {
+  id: Int @id
+  name: String?
+  name2: String?
+  authors: Blog[]
+}         
+
+model Post {
+  id: Int @id
+  title2: String
+  anotherText: String
+  tags: String[]
+  blog: Blog
+} 
+
+model AnotherModel {
+  id: Int @id
+  title: String
+  anotherText: String
+  anotherText2: String
+  tags: String[]
+}
+
```

## Photon Usage

You can use a specific Photon built for this migration (20190530104529)
in your `before` or `after` migration script like this:

```ts
import Photon from '@generated/photon/20190530104529'

const photon = new Photon()

async function main() {
  const result = await photon.users()
  console.dir(result, { depth: null })
}

main()

```
