import { describe, expect, it } from 'vitest';
import {
  classifyAnnouncer,
  classifyRegistry,
  parseStartBlock,
} from '../src/chain.js';

const observed = `0x${'11'.repeat(32)}` as const;
const expected = `0x${'22'.repeat(32)}` as const;

describe('deployment checks', () => {
  it('does not call custom-chain bytecode a mismatch without an expected hash', () => {
    expect(classifyAnnouncer(observed, undefined)).toBe('present');
    expect(classifyRegistry(observed, undefined, true)).toBe('compatible');
  });

  it('fails a configured bytecode check closed', () => {
    expect(classifyAnnouncer(observed, expected)).toBe('mismatch');
    expect(classifyRegistry(observed, expected, true)).toBe('mismatch');
  });

  it('accepts an uppercase trusted hash', () => {
    const uppercase = `0x${observed.slice(2).toUpperCase()}` as const;

    expect(classifyAnnouncer(observed, uppercase)).toBe('verified');
    expect(classifyRegistry(observed, uppercase, true)).toBe('verified');
  });

  it('requires the registry interface when no hash is configured', () => {
    expect(classifyRegistry(observed, undefined, false)).toBe('mismatch');
  });

  it('bounds the scan start block', () => {
    expect(parseStartBlock('', 100n)).toBe(101n);
    expect(parseStartBlock('42', 100n)).toBe(42n);
    expect(() => parseStartBlock('102', 100n)).toThrow('between 0 and 101');
    expect(() => parseStartBlock('-1', 100n)).toThrow('between 0 and 101');
  });
});
