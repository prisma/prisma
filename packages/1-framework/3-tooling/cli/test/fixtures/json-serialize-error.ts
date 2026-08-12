const obj: Record<string, unknown> = {};
const circular = { obj };
obj['circular'] = circular;

export const contract = {
  data: obj,
  toJSON: () => {
    throw new Error('Custom toJSON error');
  },
};
