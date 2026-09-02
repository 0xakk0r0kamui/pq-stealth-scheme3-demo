import { getAddress, type Hex } from 'viem';
import type { SignedSpend } from '@kohaku-eth/pq-stealth-scheme3';
import type { ChainConnection } from './chain.js';
import type { ComparedField, Inspection } from './inspect.js';

export async function inspectTransfer(
  connection: ChainConnection,
  hash: Hex,
  preparedTo: string,
  preparedValue: bigint,
): Promise<Inspection> {
  const [transaction, receipt] = await Promise.all([
    connection.publicClient.getTransaction({ hash }),
    connection.publicClient.getTransactionReceipt({ hash }),
  ]);

  if (!transaction.to) throw new Error('Funding transaction has no recipient');

  return {
    title: 'Fund',
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    fields: [
      field('to', getAddress(preparedTo), getAddress(transaction.to)),
      field('value · wei', preparedValue.toString(), transaction.value.toString()),
      field('input', '0x', transaction.input),
    ],
  };
}

export async function inspectSpend(
  connection: ChainConnection,
  hash: Hex,
  prepared: SignedSpend,
): Promise<Inspection> {
  const [transaction, receipt] = await Promise.all([
    connection.publicClient.getTransaction({ hash }),
    connection.publicClient.getTransactionReceipt({ hash }),
  ]);

  if (!transaction.to) throw new Error('Spend transaction has no recipient');

  return {
    title: 'Stealth spend',
    hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    fields: [
      field('type', 'eip1559', transaction.type),
      field(
        'chainId',
        prepared.transaction.chainId.toString(),
        transaction.chainId?.toString() ?? 'missing',
      ),
      field('signer', prepared.signer, getAddress(transaction.from)),
      field('to', getAddress(prepared.transaction.to), getAddress(transaction.to)),
      field('value · wei', prepared.transaction.value.toString(), transaction.value.toString()),
      field('nonce', prepared.transaction.nonce.toString(), transaction.nonce.toString()),
      field('input', prepared.transaction.data, transaction.input),
      field('tx hash', prepared.transactionHash, hash),
    ],
  };
}

function field(name: string, prepared: string, transaction: string): ComparedField {
  return { name, prepared, transaction };
}
