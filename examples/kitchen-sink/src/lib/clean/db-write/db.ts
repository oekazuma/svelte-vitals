export const items = { name: 'items' };

export const db = {
  update: (_table: typeof items) => ({ set: async (_values: Record<string, unknown>) => {} })
};
