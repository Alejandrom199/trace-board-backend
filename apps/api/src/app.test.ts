import { describe, expect, it } from 'vitest';
import { isAuthorized } from './app.js';

describe('autorización HTTP para despliegue', () => {
  it('acepta únicamente el token Bearer exacto', () => {
    const token = 'a'.repeat(32);
    expect(isAuthorized('Bearer ' + token, token)).toBe(true);
    expect(isAuthorized('Bearer ' + 'b'.repeat(32), token)).toBe(false);
    expect(isAuthorized(undefined, token)).toBe(false);
  });
});
