import {
  concatHex,
  size,
  slice,
  type Hex,
} from 'viem';

export type MetaAddressParts = {
  spendingPublicKey: Hex;
  viewingPublicKey: Hex;
  encapsulationKey: Hex;
};

export function splitMetaAddress(value: Hex): MetaAddressParts {
  if (size(value) !== 1_250) throw new Error('Scheme 3 meta-address must be 1250 bytes');

  return {
    spendingPublicKey: slice(value, 0, 33),
    viewingPublicKey: slice(value, 33, 66),
    encapsulationKey: slice(value, 66, 1_250),
  };
}

export function encodeMetaAddress(parts: MetaAddressParts): Hex {
  if (size(parts.spendingPublicKey) !== 33) {
    throw new Error('spending public key must be 33 bytes');
  }

  if (size(parts.viewingPublicKey) !== 33) {
    throw new Error('viewing public key must be 33 bytes');
  }

  if (size(parts.encapsulationKey) !== 1_184) {
    throw new Error('encapsulation key must be 1184 bytes');
  }

  return concatHex([
    parts.spendingPublicKey,
    parts.viewingPublicKey,
    parts.encapsulationKey,
  ]);
}
