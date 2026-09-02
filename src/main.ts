import {
  formatEther,
  parseEther,
} from 'viem';
import { connectChain, PUBLIC_SEPOLIA_RPC_URL } from './chain.js';
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
  setEnabled,
  setText,
  show,
} from './render.js';
import { DemoController } from './controller.js';
import './style.css';

element<HTMLInputElement>('#rpc-url').value = PUBLIC_SEPOLIA_RPC_URL;
enableCopyButtons();
const demo = new DemoController();

action('#connect', async () => {
  const url = element<HTMLInputElement>('#rpc-url').value.trim();

  if (!url) throw new Error('Enter an RPC endpoint');

  const connection = await connectChain(url);

  demo.setConnection(connection);
  setText('#chain-id', connection.chain['id'].toString());
  setText('#latest-block', connection.blockNumber.toString());
  setText('#announcer-code', connection.announcerCodeHash ?? 'no code');
  setText('#registry-code', connection.registryCodeHash ?? 'no code');
  setText('#contract-status', connection.contractsReady
    ? 'announcer and registry match'
    : 'bytecode mismatch');
  show('#network-result');

  return connection.contractsReady
    ? `Connected to chain ${connection.chain['id']}`
    : `Connected to chain ${connection.chain['id']}; announcer or registry bytecode mismatch`;
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
  demo.registerBob();

  return 'Registered on ERC-6538';
});

action('#prepare-payment', async () => {
  const sender = demo.participant('alice');
  const recipient = demo.participant('bob');
  const amount = parseEther(element<HTMLInputElement>('#payment-amount').value);
  const source = element<HTMLSelectElement>('#recipient-source').value;
  const paymentRecipient = source === 'registry'
    ? recipient.account.address
    : { metaAddress: demo.manualMetaAddress() };
  const payment = await sender.preparePayment(paymentRecipient, amount);
  const metadata = splitMetadata(payment.announcement.metadata);

  setText('#prepared-recipient', source === 'registry'
    ? recipient.account.address
    : 'stealth meta-address');
  setText('#prepared-stealth-address', payment.announcement.stealthAddress);
  setText('#prepared-epk', displayHex(payment.announcement.ephemeralPublicKey));
  setText('#prepared-view-tag', metadata.viewTag);
  setText('#prepared-ct', displayHex(metadata.ciphertext));
  show('#payment-result');
  setEnabled('#announce', true);

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
  setEnabled('#fund', true);

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
  setEnabled('#scan', true);

  return 'Funded';
});

action('#scan', async () => {
  const recipient = demo.participant('bob');
  const payment = demo.payment();
  const note = await recipient.scan(payment.announcement.stealthAddress);

  setText('#note-address', note.address);
  setText('#note-amount', `${formatEther(note.amount)} ETH`);
  setText('#note-block', note.blockNumber.toString());
  show('#note-result');
  setEnabled('#prepare-spend', true);

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
  setEnabled('#broadcast-spend', true);

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
