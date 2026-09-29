import {
  createPublicClient,
  defineChain,
  getAddress,
  http,
  isHex,
  keccak256,
  size,
  zeroAddress,
  type Address,
  type Chain,
  type Hex,
} from 'viem';

export const DEFAULT_ANNOUNCER = '0x55649E01B5Df198D18D95b5cc5051630cfD45564' as Address;
export const DEFAULT_REGISTRY = '0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538' as Address;
export const PUBLIC_SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

const SEPOLIA_CHAIN_ID = 11_155_111;
const SEPOLIA_ANNOUNCER_CODE_HASH = '0x80ed491c57edc6d92b5a85cc7db2dfeb40bbab52476b5b09b9b21c5c907b77c4';
const SEPOLIA_REGISTRY_CODE_HASH = '0x6d369f3703602b1af1b4d58aa6316d715a69f871b93a2ea126dbd1e4a58c4348';
const registryProbeAbi = [{
  type: 'function',
  name: 'stealthMetaAddressOf',
  stateMutability: 'view',
  inputs: [
    { name: 'registrant', type: 'address' },
    { name: 'schemeId', type: 'uint256' },
  ],
  outputs: [{ name: '', type: 'bytes' }],
}] as const;

export type ContractStatus = 'missing' | 'present' | 'compatible' | 'verified' | 'mismatch';

export type ContractProbe = {
  address: Address;
  codeHash?: Hex;
  status: ContractStatus;
};

export type DeploymentInput = {
  announcer: string;
  registry: string;
  startBlock?: string;
  expectedAnnouncerCodeHash?: string;
  expectedRegistryCodeHash?: string;
};

export type ChainConnection = {
  url: string;
  chain: Chain;
  publicClient: ReturnType<typeof createPublicClient>;
  blockNumber: bigint;
  announcer: Address;
  registry: Address;
  announcerStartBlock: bigint;
  announcerProbe: ContractProbe;
  registryProbe: ContractProbe;
  contractsReady: boolean;
};

export async function connectChain(
  url: string,
  deployment: DeploymentInput,
): Promise<ChainConnection> {
  const announcer = getAddress(deployment.announcer);
  const registry = getAddress(deployment.registry);
  const configuredAnnouncerHash = optionalHash(
    deployment.expectedAnnouncerCodeHash,
    'expected announcer bytecode hash',
  );
  const configuredRegistryHash = optionalHash(
    deployment.expectedRegistryCodeHash,
    'expected registry bytecode hash',
  );
  const transport = http(url);
  const probe = createPublicClient({ transport });
  const [chainId, blockNumber, announcerCode, registryCode] = await Promise.all([
    probe.getChainId(),
    probe.getBlockNumber(),
    probe.getCode({ address: announcer }),
    probe.getCode({ address: registry }),
  ]);
  const chain = defineChain({
    ['id']: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [url] } },
  });
  const announcerCodeHash = hashCode(announcerCode);
  const registryCodeHash = hashCode(registryCode);
  const expectedAnnouncerCodeHash = configuredAnnouncerHash
    ?? (chainId === SEPOLIA_CHAIN_ID ? SEPOLIA_ANNOUNCER_CODE_HASH : undefined);
  const expectedRegistryCodeHash = configuredRegistryHash
    ?? (chainId === SEPOLIA_CHAIN_ID ? SEPOLIA_REGISTRY_CODE_HASH : undefined);
  const registryResponds = registryCodeHash
    ? await probeRegistry(probe, registry)
    : false;
  const announcerProbe: ContractProbe = {
    address: announcer,
    codeHash: announcerCodeHash,
    status: classifyAnnouncer(announcerCodeHash, expectedAnnouncerCodeHash),
  };
  const registryProbe: ContractProbe = {
    address: registry,
    codeHash: registryCodeHash,
    status: classifyRegistry(registryCodeHash, expectedRegistryCodeHash, registryResponds),
  };
  const announcerStartBlock = parseStartBlock(deployment.startBlock, blockNumber);

  return {
    url,
    chain,
    publicClient: createPublicClient({ chain, transport }),
    blockNumber,
    announcer,
    registry,
    announcerStartBlock,
    announcerProbe,
    registryProbe,
    contractsReady: isUsable(announcerProbe.status) && isUsable(registryProbe.status),
  };
}

export function classifyAnnouncer(
  codeHash: Hex | undefined,
  expectedCodeHash: Hex | undefined,
): ContractStatus {
  if (!codeHash) return 'missing';
  if (!expectedCodeHash) return 'present';

  return sameHash(codeHash, expectedCodeHash) ? 'verified' : 'mismatch';
}

export function classifyRegistry(
  codeHash: Hex | undefined,
  expectedCodeHash: Hex | undefined,
  interfaceResponds: boolean,
): ContractStatus {
  if (!codeHash) return 'missing';
  if (expectedCodeHash) return sameHash(codeHash, expectedCodeHash) ? 'verified' : 'mismatch';

  return interfaceResponds ? 'compatible' : 'mismatch';
}

export function parseStartBlock(value: string | undefined, latestBlock: bigint): bigint {
  const trimmed = value?.trim();
  const startBlock = trimmed ? BigInt(trimmed) : latestBlock + 1n;

  if (startBlock < 0n || startBlock > latestBlock + 1n) {
    throw new Error(`Scan start block must be between 0 and ${latestBlock + 1n}`);
  }

  return startBlock;
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

async function probeRegistry(
  client: ReturnType<typeof createPublicClient>,
  registry: Address,
): Promise<boolean> {
  try {
    await client.readContract({
      address: registry,
      abi: registryProbeAbi,
      functionName: 'stealthMetaAddressOf',
      args: [zeroAddress, 3n],
    });

    return true;
  } catch {
    return false;
  }
}

function optionalHash(value: string | undefined, label: string): Hex | undefined {
  const trimmed = value?.trim();

  if (!trimmed) return undefined;
  if (!isHex(trimmed, { strict: true }) || size(trimmed) !== 32) {
    throw new Error(`${label} must be 32 bytes`);
  }

  return trimmed;
}

function isUsable(status: ContractStatus): boolean {
  return status === 'present' || status === 'compatible' || status === 'verified';
}

function sameHash(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
