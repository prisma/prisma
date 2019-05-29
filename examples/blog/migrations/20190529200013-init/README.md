# Migration `20190529200013-init`

## Changes

```diff
diff --git datamodel.mdl datamodel.mdl
migration last migration id..20190529200013-init
--- datamodel.dml
+++ datamodel.dml
@@ -1,0 +1,22 @@
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
+  title2: String
+  anotherText: String
+  text: String
+  tags: String[]
+  blog: Blog
+}
```

## Photon Usage

You can use a specific Photon built for this migration (20190529200013-init)
in your `before` or `after` migration script like this:

```ts
import Photon from '@generated/photon/20190529200013-init'

const photon = new Photon()

async function main() {
  const result = await photon.users()
  console.dir(result, { depth: null })
}

main()

```
