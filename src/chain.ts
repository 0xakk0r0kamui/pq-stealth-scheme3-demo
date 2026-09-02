import {
  createPublicClient,
  defineChain,
  http,
  keccak256,
  type Address,
  type Chain,
  type Hex,
} from 'viem';

export const ANNOUNCER = '0x55649E01B5Df198D18D95b5cc5051630cfD45564' as Address;
export const REGISTRY = '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538' as Address;
export const PUBLIC_SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

const ANNOUNCER_CODE_HASH = '0x80ed491c57edc6d92b5a85cc7db2dfeb40bbab52476b5b09b9b21c5c907b77c4';
const REGISTRY_CODE_HASH = '0x6d369f3703602b1af1b4d58aa6316d715a69f871b93a2ea126dbd1e4a58c4348';

export type ChainConnection = {
  url: string;
  chain: Chain;
  publicClient: ReturnType<typeof createPublicClient>;
  blockNumber: bigint;
  announcerCodeHash?: Hex;
  registryCodeHash?: Hex;
  contractsReady: boolean;
};

export async function connectChain(url: string): Promise<ChainConnection> {
  const transport = http(url);
  const probe = createPublicClient({ transport });
  const [chainId, blockNumber, announcerCode, registryCode] = await Promise.all([
    probe.getChainId(),
    probe.getBlockNumber(),
    probe.getCode({ address: ANNOUNCER }),
    probe.getCode({ address: REGISTRY }),
  ]);
  const chain = defineChain({
    ['id']: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  });
  const announcerCodeHash = hashCode(announcerCode);
  const registryCodeHash = hashCode(registryCode);

  return {
    url,
    chain,
    publicClient: createPublicClient({ chain, transport }),
    blockNumber,
    announcerCodeHash,
    registryCodeHash,
    contractsReady: announcerCodeHash === ANNOUNCER_CODE_HASH
      && registryCodeHash === REGISTRY_CODE_HASH,
  };
}

export function explorerTransaction(chainId: number, hash: Hex): string | undefined {
  const base = new Map<number, string>([
    [1, 'https://etherscan.io/tx/'],
    [11_155_111, 'https://sepolia.etherscan.io/tx/'],
  ]).get(chainId);

  return base ? `${base}${hash}` : undefined;
}

function hashCode(code: Hex | undefined): Hex | undefined {
  return code && code !== '0x' ? keccak256(code) : undefined;
}
