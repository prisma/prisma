const contractData: Record<string, unknown> = {
  foo: 'bar',
};

contractData['self'] = contractData;

export const contract = contractData;
