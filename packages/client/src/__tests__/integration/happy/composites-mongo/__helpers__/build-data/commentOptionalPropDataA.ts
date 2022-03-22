export function commentOptionalPropDataA(id: string) {
  return {
    id: id,
    country: 'France',
    content: {
      set: {
        text: 'Hello World',
        upvotes: {
          vote: true,
          userId: '10',
        },
      },
    },
  }
}
