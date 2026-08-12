# New API sketches

## Collection-based client structure

```typescript
class PostCollection extends Collection<Contract, "Post"> {
  popular() {
    return this.where((p) => p.views.gt(1000));
  }
}

// ...

const db = orm({
  contract,
  runtime,
  collections: {
    Post: PostCollection,
    // Use default collections for the rest of the model
  }
});

const posts = await db.Post.popular().all().toArray()
```

## Filter parent records by child records

```typescript
const users = await db
  .User
  .where((u) => u.posts.some((p) => p.popular()))
  .all()
  .toArray()
```

## Selecting related records

```typescript
db
  .User
  .where(conditions)
  .include('posts', (p) =>
    p.where(conditions).include('comments')
  )
  .all()
```

## Nested mutation

We're not awaiting `first()`, instead using `.comments` to drop to a `comments` collection attached to the parent `post` record.

```typescript
 db
  .Post
  .where({ id: postId })
  .first()
  .comments
  .create(commentInput)
```


## Prev iterations, rejected for now


```typescript
const users = await db
  .user
  .where(/* ... */)
  // option 1
  .select((u) => ({
    name: u.name,
    // posts: u.posts.filter((p) => p.views.gt(1000))
    posts: u.posts.select((p) => ({
      title: p.title,
      comments: p.comments,
    }))
  }))
  // option 2
  .select({
    name: true,
    posts: {
      comments: true
    }
  })
  .all()
  .toArray()
```


## Questions

1. Including the low level queries into the high level query
2. Database capabilities and the number of queries
3. Fluent API for operators: looks nice but hard to extend. Functions are more composable.
