import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';

describe('createServer', () => {
  it('builds a server without throwing', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
