import { toEventSelector } from 'viem';

export const ANNOUNCEMENT_TOPIC = toEventSelector(
  'Announcement(uint256,address,address,bytes,bytes)',
);

export const ANNOUNCER_ABI = [{
  type: 'event',
  name: 'Announcement',
  inputs: [
    { name: 'schemeId', type: 'uint256', indexed: true },
    { name: 'stealthAddress', type: 'address', indexed: true },
    { name: 'caller', type: 'address', indexed: true },
    { name: 'ephemeralPubKey', type: 'bytes', indexed: false },
    { name: 'metadata', type: 'bytes', indexed: false },
  ],
}, {
  type: 'function',
  name: 'announce',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'schemeId', type: 'uint256' },
    { name: 'stealthAddress', type: 'address' },
    { name: 'ephemeralPubKey', type: 'bytes' },
    { name: 'metadata', type: 'bytes' },
  ],
  outputs: [],
}] as const;

export const REGISTRY_ABI = [{
  type: 'function',
  name: 'registerKeys',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'schemeId', type: 'uint256' },
    { name: 'stealthMetaAddress', type: 'bytes' },
  ],
  outputs: [],
}] as const;
