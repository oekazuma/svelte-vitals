import { describe, it, expect } from 'vitest';
import { isSameOrigin } from '../src/loopback.js';

describe('isSameOrigin', () => {
  it.each([
    ['http://localhost:5173', 'localhost:5173', true],
    ['https://localhost:5173', 'localhost:5173', true], // scheme ignored (server.https)
    ['http://[::1]:5173', '[::1]:5173', true],
    ['http://localhost', 'localhost:80', true], // default port normalized by the URL parser
    ['http://LOCALHOST:5173', 'localhost:5173', true], // hostname case normalized
    ['http://localhost:3000', 'localhost:5173', false], // different port
    ['http://127.0.0.1:5173', 'localhost:5173', false], // different hostname
    ['null', 'localhost:5173', false] // sandboxed iframe / file:// Origin never parses
  ])('isSameOrigin(%s, %s) === %s', (origin, host, expected) => {
    expect(isSameOrigin(origin, host)).toBe(expected);
  });
});
