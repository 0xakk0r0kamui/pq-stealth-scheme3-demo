import {
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  size,
  slice,
  type Hex,
} from 'viem';
import type { Announcement } from '@kohaku-eth/pq-stealth-scheme3';
import type { ChainConnection } from './chain.js';
import {
  ANNOUNCEMENT_TOPIC,
  ANNOUNCER_ABI,
  REGISTRY_ABI,
} from './contracts.js';
import { splitMetaAddress } from './meta-address.js';

export type ComparedField = {
  name: string;
  prepared: string;
  transaction: string;
  event?: string;
};

export type Inspection = {
  title: string;
  hash: Hex;
  blockNumber: bigint;
  gasUsed: bigint;
  fields: ComparedField[];
};

export type MetadataParts = {
  viewTag: Hex;
  ciphertext: Hex;
};

export function splitMetadata(value: Hex): MetadataParts {
  if (size(value) !== 1_089) throw new Error('Scheme 3 metadata must be 1089 bytes');

  return {
    viewTag: slice(value, 0, 1),
    ciphertext: slice(value, 1, 1_089),
  };
}

export async function inspectRegistration(
  connection: ChainConnection,
  hash: Hex,
  preparedData: string,
  preparedMetaAddress: Hex,
  registryReadback: Hex,
): Promise<Inspection> {
  const [transaction, receipt] = await Promise.all([
    connection.publicClient.getTransaction({ hash }),
    connection.publicClient.getTransactionReceipt({ hash }),
  ]);
  const decoded = decodeFunctionData({ abi: REGISTRY_ABI, data: transaction.input });

  if (decoded.functionName !== 'registerKeys') throw new Error('Expected registerKeys');

  const [schemeId, metaAddress] = decoded.args;
  const prepared = splitMetaAddress(preparedMetaAddress);
  const calldata = splitMetaAddress(metaAddress);
  const readback = splitMetaAddress(registryReadback);

  return {
    title: 'ERC-6538 registration',
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    fields: [
      field('function', 'registerKeys', decoded.functionName),
      field('schemeId', '3', schemeId.toString()),
      field('calldata', preparedData, transaction.input),
      field('meta-address', preparedMetaAddress, metaAddress, registryReadback),
      field(
        'spending public key',
        prepared.spendingPublicKey,
        calldata.spendingPublicKey,
        readback.spendingPublicKey,
      ),
      field(
        'viewing public key',
        prepared.viewingPublicKey,
        calldata.viewingPublicKey,
        readback.viewingPublicKey,
      ),
      field(
        'encapsulation key',
        prepared.encapsulationKey,
        calldata.encapsulationKey,
        readback.encapsulationKey,
      ),
    ],
  };
}

export async function inspectAnnouncement(
  connection: ChainConnection,
  hash: Hex,
  preparedData: string,
  preparedAnnouncement: Announcement,
): Promise<Inspection> {
  const [transaction, receipt] = await Promise.all([
    connection.publicClient.getTransaction({ hash }),
    connection.publicClient.getTransactionReceipt({ hash }),
  ]);
  const decoded = decodeFunctionData({ abi: ANNOUNCER_ABI, data: transaction.input });

  if (decoded.functionName !== 'announce') throw new Error('Expected announce');

  const [schemeId, stealthAddress, ephemeralPublicKey, metadata] = decoded.args;
  const log = receipt.logs.find((entry) => entry.topics[0] === ANNOUNCEMENT_TOPIC);

  if (!log) throw new Error('Announcement event was not emitted');

  const event = decodeEventLog({
    abi: ANNOUNCER_ABI,
    eventName: 'Announcement',
    data: log.data,
    topics: [...log.topics] as [Hex, ...Hex[]],
    strict: true,
  });
  const preparedMetadata = splitMetadata(preparedAnnouncement.metadata);
  const calldataMetadata = splitMetadata(metadata);
  const eventMetadata = splitMetadata(event.args.metadata);

  return {
    title: 'ERC-5564 announcement',
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    fields: [
      field('function', 'announce', decoded.functionName),
      field('schemeId', '3', schemeId.toString(), event.args.schemeId.toString()),
      field('calldata', preparedData, transaction.input),
      field(
        'stealth address',
        preparedAnnouncement.stealthAddress,
        getAddress(stealthAddress),
        getAddress(event.args.stealthAddress),
      ),
      field(
        'ephemeral public key',
        preparedAnnouncement.ephemeralPublicKey,
        ephemeralPublicKey,
        event.args.ephemeralPubKey,
      ),
      field('metadata', preparedAnnouncement.metadata, metadata, event.args.metadata),
      field(
        'view tag',
        preparedMetadata.viewTag,
        calldataMetadata.viewTag,
        eventMetadata.viewTag,
      ),
      field(
        'ciphertext',
        preparedMetadata.ciphertext,
        calldataMetadata.ciphertext,
        eventMetadata.ciphertext,
      ),
    ],
  };
}

function field(
  name: string,
  prepared: string,
  transaction: string,
  event?: string,
): ComparedField {
  return { name, prepared, transaction, event };
}
