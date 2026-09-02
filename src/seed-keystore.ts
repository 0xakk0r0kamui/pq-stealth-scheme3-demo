import type { Keystore } from '@kohaku-eth/plugins';
import { bytesToHex, hexToBytes, isHex, numberToHex, size, type Hex } from 'viem';

export const IDENTITY_PATH = "m/5564'/60'/0'/0'";
export const SENDER_PATH = "m/5564'/60'/0'/1'";

/** Host keystore that returns these 32-byte keys at the plugin derive paths. */
export class SeedKeystore implements Keystore {
  readonly _brand = 'Keystore' as const;

  constructor(
    private readonly identitySeed: Hex,
    private readonly senderSeed: Hex,
  ) {}

  async deriveAt(path: string): Promise<Hex> {
    if (path === IDENTITY_PATH) return this.identitySeed;
    if (path === SENDER_PATH) return this.senderSeed;

    throw new Error(`Unsupported keystore path ${path}`);
  }
}

export function formatBytes(value: Hex): string {
  return [...hexToBytes(value)].join(' ');
}

export function parseBytes(value: string, length: number, label: string): Hex {
  const trimmed = value.trim();

  if (!trimmed) throw new Error(`${label} is empty`);

  if (/^[0-9]+$/.test(trimmed)) {
    return numberToHex(BigInt(trimmed), { size: length });
  }

  const compact = trimmed.replace(/\s+/g, '');

  if (/^(0x)?[0-9a-fA-F]+$/i.test(compact)) {
    const hex = (compact.startsWith('0x') ? compact : `0x${compact}`) as Hex;

    if (!isHex(hex, { strict: true }) || size(hex) !== length) {
      throw new Error(`${label} must be ${length} bytes`);
    }

    return hex;
  }

  const parts = trimmed.split(/[\s,]+/).filter(Boolean);

  if (parts.length !== length || parts.some((part) => !isByte(part))) {
    throw new Error(`${label} must be ${length} bytes`);
  }

  return bytesToHex(Uint8Array.from(parts.map((part) => Number(part))));
}

function isByte(value: string): boolean {
  if (!/^[0-9]+$/.test(value)) return false;

  const byte = Number(value);

  return byte >= 0 && byte <= 255;
}
