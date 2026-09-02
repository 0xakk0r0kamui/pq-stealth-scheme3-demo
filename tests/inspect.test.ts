import { describe, expect, it } from 'vitest';
import { concatHex } from 'viem';
import { splitMetadata } from '../src/inspect.js';
import {
  encodeMetaAddress,
  splitMetaAddress,
} from '../src/meta-address.js';

describe('scheme 3 web inspector', () => {
  it('splits the registered meta-address at the protocol boundaries', () => {
    const spendingPublicKey = bytes('11', 33);
    const viewingPublicKey = bytes('22', 33);
    const encapsulationKey = bytes('33', 1_184);
    const metaAddress = concatHex([
      spendingPublicKey,
      viewingPublicKey,
      encapsulationKey,
    ]);
    const parts = splitMetaAddress(metaAddress);

    expect(parts).toEqual({
      spendingPublicKey,
      viewingPublicKey,
      encapsulationKey,
    });
    expect(encodeMetaAddress(parts)).toBe(metaAddress);
  });

  it('splits view_tag and ciphertext from announcement metadata', () => {
    const viewTag = bytes('44', 1);
    const ciphertext = bytes('55', 1_088);
    const parts = splitMetadata(concatHex([viewTag, ciphertext]));

    expect(parts).toEqual({ viewTag, ciphertext });
  });
});

function bytes(byte: string, length: number): `0x${string}` {
  return `0x${byte.repeat(length)}`;
}
