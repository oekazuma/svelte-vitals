class KvClient {
  async set(key: string, value: unknown): Promise<void> {
    await fetch(`https://kv.example.com/${key}`, { method: 'PUT', body: JSON.stringify(value) });
  }
}

export const kv = new KvClient();
