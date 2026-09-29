import {
  formatEther,
  getAddress,
  parseEther,
} from 'viem';
import {
  connectChain,
  DEFAULT_ANNOUNCER,
  DEFAULT_REGISTRY,
  PUBLIC_SEPOLIA_RPC_URL,
  type ContractProbe,
} from './chain.js';
import {
  inspectAnnouncement,
  inspectRegistration,
  splitMetadata,
} from './inspect.js';
import { inspectSpend, inspectTransfer } from './inspect-transactions.js';
import {
  action,
  displayHex,
  element,
  enableCopyButtons,
  renderInspection,
  setText,
  show,
} from './render.js';
import { DemoController } from './controller.js';
import './style.css';

element<HTMLInputElement>('#rpc-url').value = PUBLIC_SEPOLIA_RPC_URL;
element<HTMLInputElement>('#announcer-address').value = DEFAULT_ANNOUNCER;
element<HTMLInputElement>('#registry-address').value = DEFAULT_REGISTRY;
enableCopyButtons();
const demo = new DemoController();

action('#connect', async () => {
  const url = element<HTMLInputElement>('#rpc-url').value.trim();

  if (!url) throw new Error('Enter an RPC endpoint');

  const connection = await connectChain(url, {
    announcer: element<HTMLInputElement>('#announcer-address').value,
    registry: element<HTMLInputElement>('#registry-address').value,
    startBlock: element<HTMLInputElement>('#scan-start-block').value,
    expectedAnnouncerCodeHash: element<HTMLInputElement>('#announcer-hash').value,
    expectedRegistryCodeHash: element<HTMLInputElement>('#registry-hash').value,
  });

  demo.setConnection(connection);
  setText('#chain-id', connection.chain['id'].toString());
  setText('#latest-block', connection.blockNumber.toString());
  setText('#announcer-code', describeProbe(connection.announcerProbe));
  setText('#registry-code', describeProbe(connection.registryProbe));
  setText('#active-scan-start', connection.announcerStartBlock.toString());
  setText('#contract-status', connection.contractsReady
    ? deploymentSummary(connection.announcerProbe, connection.registryProbe)
    : 'not usable; check the contract results above');
  show('#network-result');

  return connection.contractsReady
    ? `Connected to chain ${connection.chain['id']}; scan starts at block ${connection.announcerStartBlock}`
    : `Connected to chain ${connection.chain['id']}; deployment checks failed`;
});

action('#register', async () => {
  const recipient = demo.participant('bob');
  const prepared = recipient.plugin.registrationTransaction();
  const hash = await recipient.register();
  const readback = await recipient.plugin.resolveRecipient(recipient.account.address);
  const inspection = await inspectRegistration(
    recipient.connection,
    hash,
    prepared.data,
    recipient.identity.metaAddress,
    readback,
  );

  renderInspection(inspection, recipient.connection.chain['id']);

  return 'Registered on ERC-6538';
});

action('#prepare-payment', async () => {
  const sender = demo.participant('alice');
  const amount = parseEther(element<HTMLInputElement>('#payment-amount').value);
  const source = element<HTMLSelectElement>('#recipient-source').value;
  const paymentRecipient = source === 'registry'
    ? getAddress(element<HTMLInputElement>('#registry-recipient').value.trim())
    : { metaAddress: demo.manualMetaAddress() };
  const payment = await sender.preparePayment(paymentRecipient, amount);
  const metadata = splitMetadata(payment.announcement.metadata);

  setText('#prepared-recipient', source === 'registry'
    ? paymentRecipient as string
    : 'stealth meta-address');
  setText('#prepared-stealth-address', payment.announcement.stealthAddress);
  setText('#prepared-epk', displayHex(payment.announcement.ephemeralPublicKey));
  setText('#prepared-view-tag', metadata.viewTag);
  setText('#prepared-ct', displayHex(metadata.ciphertext));
  show('#payment-result');

  return 'Stealth address ready';
});

action('#announce', async () => {
  const sender = demo.participant('alice');
  const payment = demo.payment();
  const hash = await sender.announce();
  const inspection = await inspectAnnouncement(
    sender.connection,
    hash,
    payment.announcementTransaction.data,
    payment.announcement,
  );

  renderInspection(inspection, sender.connection.chain['id']);

  return 'Announced';
});

action('#fund', async () => {
  const sender = demo.participant('alice');
  const payment = demo.payment();
  const hash = await sender.fund();
  const inspection = await inspectTransfer(
    sender.connection,
    hash,
    payment.fundingTransaction.to,
    payment.fundingTransaction.value,
  );

  renderInspection(inspection, sender.connection.chain['id']);

  return 'Funded';
});

action('#scan', async () => {
  const recipient = demo.participant('bob');
  const note = await recipient.scan();

  setText('#note-address', note.address);
  setText('#note-amount', `${formatEther(note.amount)} ETH`);
  setText('#note-block', note.blockNumber.toString());
  show('#note-result');

  return 'Announcement matched';
});

action('#prepare-spend', async () => {
  const recipient = demo.participant('bob');
  const destination = element<HTMLInputElement>('#spend-recipient').value;
  const amount = parseEther(element<HTMLInputElement>('#spend-amount').value);
  const spend = await recipient.prepareSpend(destination, amount);

  setText('#spend-signer', spend.signer);
  setText('#spend-hash', spend.transactionHash);
  setText('#spend-gas', spend.transaction.gasLimit.toString());
  show('#spend-result');

  return 'Spend signed';
});

action('#broadcast-spend', async () => {
  const recipient = demo.participant('bob');
  const spend = recipient.spend;

  if (!spend) throw new Error('Prepare a spend first');

  const hash = await recipient.broadcastSpend();
  const inspection = await inspectSpend(recipient.connection, hash, spend);

  renderInspection(inspection, recipient.connection.chain['id']);

  return 'Spend included';
});

function describeProbe(probe: ContractProbe): string {
  const labels = {
    missing: 'missing',
    present: 'code present, bytecode unverified',
    compatible: 'interface compatible, bytecode unverified',
    verified: 'bytecode verified',
    mismatch: 'verification failed',
  } as const;

  return `${labels[probe.status]} · ${probe.codeHash ?? 'no code'}`;
}

function deploymentSummary(announcer: ContractProbe, registry: ContractProbe): string {
  return announcer.status === 'verified' && registry.status === 'verified'
    ? 'announcer and registry bytecode verified'
    : 'usable deployment; unverified bytecode is marked above';
}
