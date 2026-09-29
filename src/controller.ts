import {
  formatEther,
  isHex,
  type Hex,
} from 'viem';
import type { PreparedPayment } from '@kohaku-eth/pq-stealth-scheme3';
import { encodeMetaAddress } from './meta-address.js';
import {
  action,
  element,
  hide,
  renderBobMetaAddress,
  renderParticipant,
  setText,
  show,
  type ParticipantRole,
} from './render.js';
import { WalletSession } from './session.js';
import type { ChainConnection } from './chain.js';
import { parseBytes } from './seed-keystore.js';

export class DemoController {
  private connection?: ChainConnection;
  private alice?: WalletSession;
  private bob?: WalletSession;

  constructor() {
    this.setupParticipant('alice');
    this.setupParticipant('bob');
    element<HTMLSelectElement>('#recipient-source').addEventListener('change', (event) => {
      const manual = (event.currentTarget as HTMLSelectElement).value === 'manual';

      if (manual) show('#manual-meta');
      else hide('#manual-meta');
    });
  }

  setConnection(connection: ChainConnection): void {
    this.connection = connection;
    this.alice = undefined;
    this.bob = undefined;
    this.resetPayment();
    hide('#bob-meta-result');

    for (const role of ['alice', 'bob'] as const) {
      hide(`#${role}-result`);
    }
  }

  participant(role: ParticipantRole): WalletSession {
    const participant = role === 'alice' ? this.alice : this.bob;

    if (!participant) throw new Error(`${participantName(role)} is not configured`);

    return participant;
  }

  payment(): PreparedPayment {
    const payment = this.participant('alice').payment;

    if (!payment) throw new Error('Prepare a payment first');

    return payment;
  }

  manualMetaAddress(): Hex {
    const complete = element<HTMLTextAreaElement>('#manual-meta-address').value.trim();
    const metaAddress = complete
      ? parseBytes(complete, 1250, 'stealth meta-address')
      : encodeMetaAddress({
        spendingPublicKey: readHex('#manual-spending-pk', 'spending_pk'),
        viewingPublicKey: readHex('#manual-viewing-pk', 'viewing_pk_ec'),
        encapsulationKey: readHex('#manual-ek', 'ek'),
      });
    const matchesBob = this.bob?.identity.metaAddress.toLowerCase()
      === metaAddress.toLowerCase();

    setText('#manual-meta-status', matchesBob ? 'Matches web Bob' : 'Using pasted meta-address');

    return metaAddress;
  }

  private setupParticipant(role: ParticipantRole): void {
    action(`#generate-${role}`, async () => {
      const session = await WalletSession.generate(this.requireConnection());

      this.setParticipant(role, session);

      return `Generated ${participantName(role)}’s mnemonic`;
    });

    action(`#load-${role}`, async () => {
      const mnemonic = element<HTMLTextAreaElement>(`#${role}-mnemonic`).value.trim();

      if (!mnemonic) throw new Error(`Enter ${participantName(role)}’s mnemonic`);

      const session = await WalletSession.fromMnemonic(this.requireConnection(), mnemonic);

      this.setParticipant(role, session);

      return `Loaded ${participantName(role)}’s mnemonic`;
    });

    action(`#balance-${role}`, async () => {
      const session = this.participant(role);
      const amount = `${formatEther(await session.balance())} ETH`;

      setText(`#${role}-balance`, amount);

      return `${participantName(role)} ${amount}`;
    });
  }

  private setParticipant(role: ParticipantRole, session: WalletSession): void {
    this.resetPayment();

    if (role === 'alice') {
      this.alice = session;
      element<HTMLInputElement>('#spend-recipient').value = session.account.address;
    } else {
      this.bob = session;
      renderBobMetaAddress(session);
      element<HTMLInputElement>('#registry-recipient').value = session.account.address;
    }

    renderParticipant(role, session);
  }

  private resetPayment(): void {
    hide('#payment-result');
    hide('#note-result');
    hide('#spend-result');
  }

  private requireConnection(): ChainConnection {
    if (!this.connection) throw new Error('Connect to an RPC first');
    if (!this.connection.contractsReady) {
      throw new Error('Configure usable announcer and registry contracts first');
    }

    return this.connection;
  }
}

function readHex(selector: string, label: string): Hex {
  const value = element<HTMLInputElement | HTMLTextAreaElement>(selector).value.trim();

  if (!isHex(value, { strict: true })) throw new Error(`${label} must be bytes`);

  return value;
}

function participantName(role: ParticipantRole): 'Alice' | 'Bob' {
  return role === 'alice' ? 'Alice' : 'Bob';
}
