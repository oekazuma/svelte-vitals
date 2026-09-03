import { describe, it, expect } from 'vitest';
import { isSameOrigin } from '../src/loopback.js';

describe('isSameOrigin', () => {
  it.each([
    ['http://localhost:5173', 'localhost:5173', false, true],
    ['https://localhost:5173', 'localhost:5173', false, true], // scheme ignored when port is explicit
    ['http://[::1]:5173', '[::1]:5173', false, true],
    ['http://localhost', 'localhost:80', false, true], // default port normalized by the URL parser
    ['http://LOCALHOST:5173', 'localhost:5173', false, true], // hostname case normalized
    ['http://localhost:3000', 'localhost:5173', false, false], // different port
    ['http://127.0.0.1:5173', 'localhost:5173', false, false], // different hostname
    ['null', 'localhost:5173', false, false], // sandboxed iframe / file:// Origin never parses
    ['https://localhost', 'localhost:80', false, false], // https default 443 ≠ 80
    ['https://localhost:443', 'localhost:443', true, true], // explicit 443 on a TLS server
    ['https://localhost', 'localhost', true, true], // both default 443 on a TLS server
    ['http://localhost', 'localhost', true, false], // http default 80 ≠ TLS server's 443
    ['http://localhost', 'localhost', false, true] // both default 80 on a plain server
  ])('isSameOrigin(%s, %s, secure=%s) === %s', (origin, host, secure, expected) => {
    expect(isSameOrigin(origin, host, secure)).toBe(expected);
  });
});
