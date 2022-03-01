export function commentRequiredListDataA(id: string) {
  return {
    id: id,
    country: 'France',
    contents: {
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
