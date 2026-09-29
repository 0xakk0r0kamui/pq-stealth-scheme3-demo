import { MemoryStorage, MnemonicKeystore, type Host } from '@kohaku-eth/plugins';
import { viem as kohakuViem } from '@kohaku-eth/provider/viem';
import {
  bytesToHex,
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
  SeedKeystore,
} from './seed-keystore.js';
import type { ChainConnection } from './chain.js';

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
  private registrationHash?: Hex;
  private announcementHash?: Hex;
  private fundingHash?: Hex;
  private spendHash?: Hex;
  private activeOperation?: string;

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
    const identitySeed = await keystore.deriveAt(IDENTITY_PATH);
    const senderSeed = randomSeed();

    return WalletSession.open(
      connection,
      phrase,
      new SeedKeystore(
        identitySeed,
        senderSeed,
      ),
      identitySeed,
      senderSeed,
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
    const deployment = {
      announcer: connection.announcer,
      registry: connection.registry,
      announcerStartBlock: connection.announcerStartBlock,
      finalityDepth: 0n,
      scanBatchSize: 100n,
      rescanBlocks: 10n,
    };
    const plugin = await createScheme3Plugin(host, {
      accountIndex: 0,
      mode: 'create',
      assets: [{ __type: 'native' }] as const,
      deployment,
    });

    return new WalletSession(connection, mnemonic, identitySeed, senderSeed, plugin);
  }

  balance(): Promise<bigint> {
    return this.connection.publicClient.getBalance({ address: this.account.address });
  }

  async register(): Promise<Hex> {
    return this.runExclusive('registration', async () => {
      if (this.registrationHash) {
        throw new Error(`Registration already submitted: ${this.registrationHash}`);
      }

      const hash = await this.broadcast(this.plugin.registrationTransaction());

      this.registrationHash = hash;
      await this.confirm(hash);

      return hash;
    });
  }

  async preparePayment(recipient: Recipient, amount: bigint): Promise<PreparedPayment> {
    return this.runExclusive('payment preparation', async () => {
      const payment = await this.plugin.preparePayment({
        recipient,
        asset: { __type: 'native' },
        amount,
      });

      this.payment = payment;
      this.announcementHash = undefined;
      this.fundingHash = undefined;

      return payment;
    });
  }

  async announce(): Promise<Hex> {
    return this.runExclusive('announcement', async () => {
      if (!this.payment) throw new Error('Prepare a payment first');
      if (this.announcementHash) {
        throw new Error(`Announcement already submitted: ${this.announcementHash}`);
      }

      const hash = await this.broadcast(this.payment.announcementTransaction);

      this.announcementHash = hash;
      await this.confirm(hash);

      return hash;
    });
  }

  async fund(): Promise<Hex> {
    return this.runExclusive('funding', async () => {
      if (!this.payment) throw new Error('Prepare a payment first');
      if (!this.announcementHash) throw new Error('Announce the payment first');
      if (this.fundingHash) throw new Error(`Funding already submitted: ${this.fundingHash}`);

      const hash = await this.broadcast(this.payment.fundingTransaction);

      this.fundingHash = hash;
      await this.confirm(hash);

      return hash;
    });
  }

  async scan(): Promise<Note> {
    return this.runExclusive('scan', async () => {
      const notes = await this.plugin.scan();
      const note = notes
        .filter((candidate) => !candidate.spent && candidate.amount > 0n)
        .sort((left, right) => left.blockNumber === right.blockNumber
          ? 0
          : left.blockNumber < right.blockNumber ? 1 : -1)[0];

      if (!note) throw new Error('No unspent funded note found in the configured scan range');

      this.note = note;
      this.spend = undefined;
      this.spendHash = undefined;

      return note;
    });
  }

  async prepareSpend(recipient: string, amount: bigint): Promise<SignedSpend> {
    return this.runExclusive('spend preparation', async () => {
      if (!this.note) throw new Error('Scan a funded stealth address first');

      const spend = await this.plugin.prepareSpend({
        noteId: this.note.noteId,
        recipient: getAddress(recipient),
        amount,
      });

      this.spend = spend;
      this.spendHash = undefined;

      return spend;
    });
  }

  async broadcastSpend(): Promise<Hex> {
    return this.runExclusive('spend broadcast', async () => {
      if (!this.spend) throw new Error('Prepare a spend first');
      if (this.spendHash) throw new Error(`Spend already submitted: ${this.spendHash}`);

      const hash = await this.plugin.submitSpend(this.spend);

      this.spendHash = hash;
      await this.confirm(hash);

      return hash;
    });
  }

  private async broadcast(transaction: { to: string; data: string; value: bigint }): Promise<Hex> {
    return this.walletClient.sendTransaction({
      account: this.account,
      chain: this.connection.chain,
      to: transaction.to as Address,
      data: transaction.data as Hex,
      value: transaction.value,
    });
  }

  private async confirm(hash: Hex): Promise<void> {
    const receipt = await this.connection.publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== 'success') throw new Error(`Transaction reverted: ${hash}`);
  }

  private async runExclusive<T>(operation: string, run: () => Promise<T>): Promise<T> {
    if (this.activeOperation) {
      throw new Error(`Wait for ${this.activeOperation} to finish`);
    }
    this.activeOperation = operation;

    try {
      return await run();
    } finally {
      this.activeOperation = undefined;
    }
  }
}

function randomSeed(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}
