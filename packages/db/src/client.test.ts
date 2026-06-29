import { beforeEach, describe, expect, it } from 'vitest';
import { resetPrismaClient, setPrismaClient, getPrismaClient } from './client';

describe('db client registry', () => {
  beforeEach(() => {
    resetPrismaClient();
  });

  it('throws when no client registered', () => {
    expect(() => getPrismaClient()).toThrow(/not initialized/);
  });

  it('returns registered client', () => {
    const fake = { marker: true } as never;
    setPrismaClient(fake);
    expect(getPrismaClient()).toBe(fake);
  });
});
