import { describe, expect, it, beforeEach } from 'vitest';
import { setHostShell, getHostShell, tryGetHostShell, createWebHostShell } from '../src';

describe('host registry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('throws when no shell registered', () => {
    try {
      getHostShell();
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).toMatch(/not initialized/);
    }
  });

  it('returns null from tryGetHostShell when unset', () => {
    expect(tryGetHostShell()).toBeNull();
  });

  it('web shell writes and reads text', async () => {
    setHostShell(createWebHostShell());
    const shell = getHostShell();
    const fs = shell.fs();
    const p = fs.join('a', 'b.txt');
    await fs.writeText(p, 'hello');
    expect(await fs.readText(p)).toBe('hello');
    expect(await fs.exists(p)).toBe(true);
  });

  it('web shell identifies platform as web', () => {
    setHostShell(createWebHostShell());
    expect(getHostShell().platform()).toBe('web');
    expect(getHostShell().isPortable()).toBe(true);
  });
});
