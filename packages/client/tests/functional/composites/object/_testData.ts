export function commentDataA(id: string) {
  return {
    id: id,
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

export function commentDataB(id: string) {
  return {
    id: id,
    country: 'France',
    content: {
      text: 'Goodbye World',
      upvotes: [
        {
          vote: false,
          userId: '11',
        },
        {
          vote: true,
          userId: '12',
        },
      ],
    },
  }
}

export function commentListDataA(id: string) {
  return {
    id: id,
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

export function commentListDataB(id: string) {
  return {
    id: id,
    country: 'France',
    contents: {
      set: [
        {
          text: 'Goodbye World',
          upvotes: {
            vote: false,
            userId: '11',
          },
        },
        {
          text: 'Hello World',
          upvotes: {
            vote: true,
            userId: '10',
          },
        },
        {
          text: 'Hello World',
          upvotes: [],
        },
      ],
    },
  }
}
