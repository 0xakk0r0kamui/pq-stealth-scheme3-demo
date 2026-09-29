import type { Host } from '@kohaku-eth/plugins';
import { createScheme3Plugin } from '@kohaku-eth/pq-stealth-scheme3';
import {
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  type Address,
  type Hex,
} from 'viem';
import { describe, expect, it } from 'vitest';

const ANNOUNCER = `0x${'11'.repeat(20)}` as Address;
const REGISTRY = `0x${'22'.repeat(20)}` as Address;
const CALLER = `0x${'33'.repeat(20)}` as Address;
const RECIPIENT = `0x${'55'.repeat(20)}` as Address;
const RUST_STEALTH_ADDRESS = '0x3d2fe245c88Ae077b313a34fE65f858c5e36Eb63' as Address;
const RUST_EPHEMERAL_PUBLIC_KEY = '0x032c0b7cf95324a07d05398b240174dc0c2be444d96b159aa6c7f7b1e668680991' as Hex;
const RUST_METADATA = '0x9a86ca263c32d52be9ebb4dda4c3b0d4b474741a4e94c5a2036bc52aab8477e1bd651b6077b33c678ef6756a216d944a394b2610418fd7c09f3582eb97c2bcb98cfea2a8220b13dd9fa1a5c18e7f807f9ce008cec9aa7bdcf8ba6c3a60c701e72f7c2bc4eb7a9fc3bb52a91b6741489b01157f330a0ad04d50742b10cafd643e52b8949b1fe000aaf0f7963390242b0985d5099f405159f6a79ce1274bab2fe2e0bdce184d2d4010963b9447cfaf8ee2a079872a90da1427ddfb3e2a35f9493697144ada34499d6bafcbfacf2164ffb975a2d306514020944e0bd0aebd466dbbd5a81042c1a3d9f9949410c554dc3ae35b92b2f11dbdab9b58e401137924f605b6f500d146ec05bbfb90525f8bfcc24744914a3a5a5d9b08791068290d07ddfa857d5c76c54829c5a08583ec83a948057e8bf6b7d660a39ccf8f3c01270dbc2852cbb7cb69298207db3192e01c5866773126a2ff6131d8b87ebdcc800596e178f3ae22f7d99bd680eb44b5dbda145ece1d86b04f2f23888f17094ed93afe92656bd9f5a222a8edda5b740762b4cced41172fbaefb1ef7d06450a671c2d8769ccb0960b4cdd28e57f802bbcaab14e7908e247174b91624432704e9206a39cad635eb699f9b980c3d343bd9ad44317908439a71b931fccf990e10f1abedeffcb60c277b161e24e4ad35908fb2ef58aaeaddfec52e5907af050b67a61dacdc0a669f1895fa61ffe18445b88d2f19d3c91698fb2dd7b70545595e64b636d5a741506e9bcea114ae8f48393f07e72da268943aa52b692b1a54b738719089367019a70bde9c45f29205c5e727367952cf98f5a2e15300ded2fbfce27ccd30acbdb65362f1413f63d4900963fb77ff7393b864c10fc7ab4544b0a3abcdd004b28cef7a27a4e10c1cb83ce1f58051efb3f04f2833b422e284dbe68f0ea485903879258de6f305dd1df165cdebb0ddcaf0ad1db64b21f04ddea6605d386fdcbe466635f42cce4a3f865c26d983dcd2d073e8f82741fd1879996302a7767a8f5faa78f06a0b63902f741b9a837335e14ad1648761caffb06f8a20390530f6e82262ec1c850fc505ccc0be8faa0afba1827a8a6ee4a7bd2e44489a1f5e24bd848378494db93cce1ed9d0a9580f43d9a68db93367c39966404cf894ce5cbf04e01c27f6bdeaef18552a53ce26ce2a7cad21425562683b6ce6c710841e8428cea8e0ed53c3ffa9df1913808143dae574daa29f2974120768b94fa6a23c79871c66383720ac24660ff9613fa641330d34f0ad167f244cc2e4709cbbd57c5576530e6b67c50daf33ede1b35e7ee67dd1c52fa79365c82f84d8623086f0f552f5995107319ea0899e1ea9bb20940a7f6c9c6bdde180617ef798cd9c262cbe501b5222b0f132e26f8c1750e478b4e3fe2d674a655f71c8dde149ecff3da3aab198edcc4e1d7b935adaded6754698c24f454d26962582fe327532dd9dfd0c9bb787067741bbc7d73a7ad95c002d374ff5edf667f73b0a2bd16b7fd919132a08b467c70f71a74dfc9ac0e' as Hex;
const TS_STEALTH_ADDRESS = '0x9199af732B68B60c5784D14A59e47E43b514c3D5' as Address;
const TS_EPHEMERAL_PUBLIC_KEY = '0x027f9358dceec3b8252cc10f0c15d1bd90a7de5f680bb4a0da5bb663ae5a6345bd' as Hex;
const TS_METADATA = '0xa10c3f97c3aaa59f025d43002f3bd09cb6219281dc48fa4703fe710b04c5eeded907a4f1bbe79c8a1f285822b62ccea45dd9f5cb958412ecfa72e2587c54f63ec16ca297cb6dd67478b03a388adff462fe6ed31a13c36ccb530e80ea94f0335d63de8b3564bd0fe4a4124e78a07a6a1308a8956bc1299b74a4e5ff0b4200ef7a80eb40bbff7edd6bc1dcf776bbc189be28995e504a206165acb7253c1cbcb40609ed2db0af5d949178e7b3a9733d3173e3d52a17edb65a603d6c0e620a1522a3bf780de07b6d084dec8a07c2e8bf78850f4412a161ad7f29d9013e723d4eb4f79a6416744cbed2cd04d7e5cef8906844649f3bc99726cebffb9c87aef24931e5544bfe5cc30518dc3aa395db159512ce97652b6243a3be361d691079de1d1bf9253de68150aa4e31cf181113049ddd5df437d9a7521b7ca8b3f5197e29326119c69dea9c93eeb0a3565f134651501d032da31cc256f73fea42dbe8f9d54aca762aeeccff7fbff14b745325ba90aa1d400704d4946967b7115ec40b132e5c2fdf13850ffcc138ea0d32f6ed087740a6c8221939e02bf367a310dbaf2c93de8bb7c5b1f276cf1686eea17b06e76863e3b0aa45c381293c1818b3975ad7d70bbab257deb12210e8f543258558b8f5887b73cce295bc5bdec448beb8caf38317b4e6d098a933bed2fe0de57c4f650106769bc0c85b97d78e1c5bf57012ea45dfab7201d74f80892c05de80ac673630387d25fde2c878359ce0bf82d611d58f1eb68b8ed4de943f7df5e66bd14cd69147798b70c6716818758a09766a4b007b8b93c3c7195906065cfa2ee5d98e0a57f76e41ce906485160e0d59bb5ae37f7ba6d8e47e398ab15b2512ea39990bb6f38d7a01b8b2be89bbe5de9c6c1cae6cbf5f57d00b2e7155ce06e1b91d5573baf0180b4f39a86c196361ce39eca990e0938ab1edf29f8bdb3337f084411b0b8f168273ca7f3dc1e9a10606cef330086138b8fa25360b85eb881dc4a574a541842daa8b87000e80eedb22f61a1e53674b27d5441f80efedf2a41b4ca9c34be8844e3ae5fae70cb8ef67bf14a10a57d1a1fd7660078199a97b6af768efd1fd730df8a566eb08e7ff9ede85583e795111e7742993a491e8874e90055ce961357d994e8e94e64b82253d1cf51aaabf7da0dabf72679e2afa4aba41364d9ed9a3d4880fc4cef0a3309e1ce4819fefefa9eeb0effb869506f57ffa407cef42b40c32427c5bae13fc9564baaff275bd18f740f0e56900ea4d2263d0a382b525fda40e8f9469fde2d708f88d021014ab5148908a85489148119239d1ff6db2cdd01472ecc12164168e12fd75873d1c28b87e2e2cccac75b3e2bbcd62c890d75d09abc793073eb006df14f8db5821a792537e2493afc709d616baacfdadabb4f19e790ba937ca8747fcfb32311f72de663eb488fb057d70e581c6165715e82bbabf62dbf19fd41a6eead1ced2d8b5f28552315d3cdf80842afd869be676a80046393b0b9ec5f3373721509e077296cb001620b17df06fa66232' as Hex;

const announcementAbi = [{
  type: 'event',
  name: 'Announcement',
  inputs: [
    { name: 'schemeId', type: 'uint256', indexed: true },
    { name: 'stealthAddress', type: 'address', indexed: true },
    { name: 'caller', type: 'address', indexed: true },
    { name: 'ephemeralPubKey', type: 'bytes', indexed: false },
    { name: 'metadata', type: 'bytes', indexed: false },
  ],
}] as const;

class TestStorage {
  readonly _brand = 'Storage' as const;
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('Rust and TypeScript interoperability', () => {
  it('reproduces the TypeScript fixture consumed by Rust', async () => {
    const host = {
      storage: new TestStorage(),
      keystore: {
        deriveAt: async (path: string) => {
          if (path === "m/5564'/60'/0'/0'") return `0x${'07'.repeat(32)}` as Hex;
          if (path === "m/5564'/60'/0'/1'") return `0x${'09'.repeat(32)}` as Hex;
          throw new Error(`Unexpected key path: ${path}`);
        },
      },
      provider: {
        getChainId: async () => 1n,
        getCode: async () => '0x01' as Hex,
      },
      network: { fetch: globalThis.fetch.bind(globalThis) },
    } as unknown as Host;
    const plugin = await createScheme3Plugin(host, {
      accountIndex: 0,
      mode: 'create',
      assets: [{ __type: 'native' }],
      deployment: {
        announcer: ANNOUNCER,
        registry: REGISTRY,
        announcerStartBlock: 0n,
      },
    });
    const payment = await plugin.preparePayment({
      recipient: { metaAddress: plugin.identity().metaAddress },
      asset: { __type: 'native' },
      amount: 1n,
    });

    expect(plugin.identity().keygenIndex).toBe(0n);
    expect(payment.announcement).toEqual({
      schemeId: 3,
      stealthAddress: TS_STEALTH_ADDRESS,
      ephemeralPublicKey: TS_EPHEMERAL_PUBLIC_KEY,
      metadata: TS_METADATA,
    });
  });

  it('scans and signs a spend for a Rust-generated announcement', async () => {
    expect(keccak256(RUST_METADATA)).toBe(
      '0x659bbed65ea29fc7e1b547e0f10b39c53ce8ba8b1bef21ab6207ae1e960b59f0',
    );
    const log = {
      address: ANNOUNCER,
      blockNumber: 5n,
      topics: encodeEventTopics({
        abi: announcementAbi,
        eventName: 'Announcement',
        args: {
          schemeId: 3n,
          stealthAddress: RUST_STEALTH_ADDRESS,
          caller: CALLER,
        },
      }) as Hex[],
      data: encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }],
        [RUST_EPHEMERAL_PUBLIC_KEY, RUST_METADATA],
      ),
    };
    const provider = {
      getChainId: async () => 1n,
      getCode: async () => '0x01' as Hex,
      getBlockNumber: async () => 10n,
      getLogs: async () => [log],
      getBalance: async () => 1_000_000_000_000_000_000n,
      getGasPrice: async () => 1n,
      estimateGas: async () => 21_000n,
      getTransactionCount: async () => 0,
    };
    const host = {
      storage: new TestStorage(),
      keystore: {
        deriveAt: async (path: string) => {
          expect(path).toBe("m/5564'/60'/0'/0'");
          return `0x${'07'.repeat(32)}` as Hex;
        },
      },
      provider,
      network: { fetch: globalThis.fetch.bind(globalThis) },
    } as unknown as Host;
    const plugin = await createScheme3Plugin(host, {
      accountIndex: 0,
      mode: 'receive-only',
      assets: [{ __type: 'native' }],
      deployment: {
        announcer: ANNOUNCER,
        registry: REGISTRY,
        announcerStartBlock: 0n,
        finalityDepth: 0n,
      },
    });

    expect(plugin.identity().keygenIndex).toBe(0n);
    expect(keccak256(plugin.identity().metaAddress)).toBe(
      '0x8db2b7b7eded349ced2c3f5d7ac7c3885c903f72c55dc44582704745e8cb3966',
    );
    const notes = await plugin.scan();
    expect(notes).toHaveLength(1);
    expect(notes[0]?.address).toBe(RUST_STEALTH_ADDRESS);

    const spend = await plugin.prepareSpend({
      noteId: notes[0]!.noteId,
      recipient: RECIPIENT,
      amount: 1n,
    });
    expect(spend.signer).toBe(RUST_STEALTH_ADDRESS);
  });
});
