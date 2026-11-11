// Stands in for a persistence client: the module keeps nothing between requests.
function connect() {
  return {
    async set(key: string, value: string): Promise<void> {
      await Promise.resolve([key, value]);
    }
  };
}

export const kv = connect();
