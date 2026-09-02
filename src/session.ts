import { MemoryStorage, MnemonicKeystore, type Host } from '@kohaku-eth/plugins';
import { viem as kohakuViem } from '@kohaku-eth/provider/viem';
import {
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hex,
} from 'viem';
import {
  english,
  generateMnemonic,
  mnemonicToAccount,
  type LocalAccount,
} from 'viem/accounts';
import {
  createScheme3Plugin,
  type Identity,
  type Note,
  type PreparedPayment,
  type Recipient,
  type Scheme3Instance,
  type SignedSpend,
} from '@kohaku-eth/pq-stealth-scheme3';
import type { Keystore } from '@kohaku-eth/plugins';
import {
  IDENTITY_PATH,
  SENDER_PATH,
  SeedKeystore,
  parseBytes,
} from './seed-keystore.js';
import type { ChainConnection } from './chain.js';
import { ANNOUNCER, REGISTRY } from './chain.js';

export class WalletSession {
  readonly account: LocalAccount;
  readonly mnemonic: string;
  readonly identitySeed: Hex;
  readonly senderSeed: Hex;
  readonly identity: Identity;
  readonly plugin: Scheme3Instance;
  payment?: PreparedPayment;
  note?: Note;
  spend?: SignedSpend;

  private readonly walletClient;

  private constructor(
    readonly connection: ChainConnection,
    mnemonic: string,
    identitySeed: Hex,
    senderSeed: Hex,
    plugin: Scheme3Instance,
  ) {
    this.account = mnemonicToAccount(mnemonic);
    this.mnemonic = mnemonic;
    this.identitySeed = identitySeed;
    this.senderSeed = senderSeed;
    this.identity = plugin.identity();
    this.plugin = plugin;
    this.walletClient = createWalletClient({
      account: this.account,
      chain: connection.chain,
      transport: http(connection.url),
    });
  }

  static generate(connection: ChainConnection): Promise<WalletSession> {
    return WalletSession.fromMnemonic(connection, generateMnemonic(english, 256));
  }

  static async fromMnemonic(
    connection: ChainConnection,
    mnemonic: string,
  ): Promise<WalletSession> {
    const phrase = mnemonic.trim();
    const keystore = new MnemonicKeystore(phrase);
    const [identitySeed, senderSeed] = await Promise.all([
      keystore.deriveAt(IDENTITY_PATH),
      keystore.deriveAt(SENDER_PATH),
    ]);

    return WalletSession.open(connection, phrase, keystore, identitySeed, senderSeed);
  }

  static fromSeeds(
    connection: ChainConnection,
    mnemonic: string,
    identitySeed: string,
    senderSeed: string,
  ): Promise<WalletSession> {
    const phrase = mnemonic.trim();

    mnemonicToAccount(phrase);

    return WalletSession.open(
      connection,
      phrase,
      new SeedKeystore(
        parseBytes(identitySeed, 32, 'keygen key'),
        parseBytes(senderSeed, 32, 'sender key'),
      ),
      parseBytes(identitySeed, 32, 'keygen key'),
      parseBytes(senderSeed, 32, 'sender key'),
    );
  }

  private static async open(
    connection: ChainConnection,
    mnemonic: string,
    keystore: Keystore,
    identitySeed: Hex,
    senderSeed: Hex,
  ): Promise<WalletSession> {
    const host: Host = {
      keystore,
      storage: new MemoryStorage(),
      provider: kohakuViem(connection.publicClient),
      network: { fetch: globalThis.fetch.bind(globalThis) },
    };
    const plugin = await createScheme3Plugin(host, {
      accountIndex: 0,
      mode: 'create',
      assets: [{ __type: 'native' }],
      deployment: {
        announcer: ANNOUNCER,
        registry: REGISTRY,
        announcerStartBlock: connection.blockNumber + 1n,
        finalityDepth: 0n,
        scanBatchSize: 100n,
        rescanBlocks: 10n,
      },
    });

    return new WalletSession(connection, mnemonic, identitySeed, senderSeed, plugin);
  }

  balance(): Promise<bigint> {
    return this.connection.publicClient.getBalance({ address: this.account.address });
  }

  async register(): Promise<Hex> {
    return this.send(this.plugin.registrationTransaction());
  }

  async preparePayment(recipient: Recipient, amount: bigint): Promise<PreparedPayment> {
    this.payment = await this.plugin.preparePayment({
      recipient,
      asset: { __type: 'native' },
      amount,
    });

    return this.payment;
  }

  announce(): Promise<Hex> {
    if (!this.payment) throw new Error('Prepare a payment first');

    return this.send(this.payment.announcementTransaction);
  }

  fund(): Promise<Hex> {
    if (!this.payment) throw new Error('Prepare a payment first');

    return this.send(this.payment.fundingTransaction);
  }

  async scan(stealthAddress: Address): Promise<Note> {
    const notes = await this.plugin.scan();
    const note = notes.find((candidate) => candidate.address.toLowerCase()
      === stealthAddress.toLowerCase());

    if (!note) throw new Error('No matching stealth address');

    this.note = note;

    return note;
  }

  async prepareSpend(recipient: string, amount: bigint): Promise<SignedSpend> {
    if (!this.note) throw new Error('Scan a funded stealth address first');

    this.spend = await this.plugin.prepareSpend({
      noteId: this.note.noteId,
      recipient: getAddress(recipient),
      amount,
    });

    return this.spend;
  }

  async broadcastSpend(): Promise<Hex> {
    if (!this.spend) throw new Error('Prepare a spend first');

    const hash = await this.plugin.submitSpend(this.spend);
    const receipt = await this.connection.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);

    return hash;
  }

  private async send(transaction: { to: string; data: string; value: bigint }): Promise<Hex> {
    const hash = await this.walletClient.sendTransaction({
      account: this.account,
      chain: this.connection.chain,
      to: transaction.to as Address,
      data: transaction.data as Hex,
      value: transaction.value,
    });
    const receipt = await this.connection.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);

    return hash;
  }
}
