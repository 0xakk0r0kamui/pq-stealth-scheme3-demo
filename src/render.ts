import { isHex, keccak256, size, type Hex } from 'viem';
import { explorerTransaction } from './chain.js';
import type { Inspection } from './inspect.js';
import { splitMetaAddress } from './meta-address.js';
import { formatBytes } from './seed-keystore.js';
import type { WalletSession } from './session.js';

export type ParticipantRole = 'alice' | 'bob';

export function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);

  if (!found) throw new Error(`Missing element ${selector}`);

  return found;
}

export function setText(selector: string, value: string): void {
  element(selector).textContent = value;
}

export function setEnabled(selector: string, enabled: boolean): void {
  element<HTMLButtonElement>(selector).disabled = !enabled;
}

export function show(selector: string): void {
  element(selector).classList.remove('hidden');
}

export function hide(selector: string): void {
  element(selector).classList.add('hidden');
}

export function status(message: string, kind: 'idle' | 'working' | 'ok' | 'error'): void {
  const output = element('#status');

  output.textContent = message;
  output.dataset['kind'] = kind;
}

export function action(selector: string, run: () => Promise<string>): void {
  const button = element<HTMLButtonElement>(selector);

  button.addEventListener('click', async () => {
    button.disabled = true;
    status('Working…', 'working');

    try {
      status(await run(), 'ok');
    } catch (error) {
      status(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      button.disabled = false;
    }
  });
}

export function enableCopyButtons(): void {
  document.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]');

    if (!button) return;

    const source = element<HTMLInputElement | HTMLTextAreaElement>(button.dataset['copy']!);

    await navigator.clipboard.writeText(source.value);
    button.textContent = 'Copied';
  });
}

export function renderInspection(
  inspection: Inspection,
  chainId: number,
): void {
  const root = element('#inspections');
  const card = document.createElement('article');
  const heading = document.createElement('div');
  const title = document.createElement('h3');
  const explorer = explorerTransaction(chainId, inspection.hash);
  const transaction = document.createElement(explorer ? 'a' : 'code');

  card.className = 'inspection';
  heading.className = 'inspection-heading';
  title.textContent = inspection.title;
  transaction.textContent = shortHex(inspection.hash);

  if (transaction instanceof HTMLAnchorElement && explorer) {
    transaction.href = explorer;
    transaction.target = '_blank';
    transaction.rel = 'noreferrer';
  }

  heading.append(title, transaction);
  card.append(heading);

  const summary = document.createElement('p');

  summary.className = 'muted';
  summary.textContent = `block ${inspection.blockNumber} · gas ${inspection.gasUsed}`;
  card.append(summary);

  const table = document.createElement('table');

  table.innerHTML = '<thead><tr><th>Field</th><th>Prepared</th>'
    + '<th>Transaction</th><th>Log</th><th></th></tr></thead>';
  const body = document.createElement('tbody');

  for (const field of inspection.fields) {
    const row = document.createElement('tr');
    const values = [field.prepared, field.transaction, field.event];
    const matches = equal(field.prepared, field.transaction)
      && (field.event === undefined || equal(field.prepared, field.event));

    row.append(cell(field.name));
    values.forEach((value) => row.append(valueCell(value)));
    row.append(cell(matches ? '✓' : '✕', matches ? 'match' : 'mismatch'));
    body.append(row);
  }
  table.append(body);
  card.append(table);
  root.prepend(card);
}

export function renderParticipant(role: ParticipantRole, session: WalletSession): void {
  element<HTMLTextAreaElement>(`#${role}-mnemonic`).value = session.mnemonic;
  element<HTMLTextAreaElement>(`#${role}-identity-seed`).value = formatBytes(session.identitySeed);
  element<HTMLTextAreaElement>(`#${role}-sender-seed`).value = formatBytes(session.senderSeed);
  element<HTMLInputElement>(`#${role}-address`).value = session.account.address;
  show(`#${role}-result`);
}

export function renderBobMetaAddress(session: WalletSession): void {
  const meta = splitMetaAddress(session.identity.metaAddress);

  element<HTMLTextAreaElement>('#bob-meta-address').value = session.identity.metaAddress;
  element<HTMLInputElement>('#bob-spending-pk').value = meta.spendingPublicKey;
  element<HTMLInputElement>('#bob-viewing-pk').value = meta.viewingPublicKey;
  element<HTMLTextAreaElement>('#bob-ek').value = meta.encapsulationKey;
  element<HTMLInputElement>('#manual-spending-pk').value = meta.spendingPublicKey;
  element<HTMLInputElement>('#manual-viewing-pk').value = meta.viewingPublicKey;
  element<HTMLTextAreaElement>('#manual-ek').value = meta.encapsulationKey;
  setText('#keygen-index', session.identity.keygenIndex.toString());
  show('#bob-meta-result');
}

export function displayHex(value: Hex): string {
  return `${size(value)} B · ${shortHex(value)} · keccak256 ${keccak256(value)}`;
}

function valueCell(value: string | undefined): HTMLTableCellElement {
  const output = document.createElement('td');

  if (value === undefined) {
    output.textContent = '—';

    return output;
  }

  if (isHex(value, { strict: true }) && value.length > 90) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const raw = document.createElement('code');

    summary.textContent = displayHex(value);
    raw.textContent = value;
    details.append(summary, raw);
    output.append(details);

    return output;
  }

  const code = document.createElement('code');

  code.textContent = value;
  output.append(code);

  return output;
}

function cell(value: string, className?: string): HTMLTableCellElement {
  const output = document.createElement('td');

  output.textContent = value;

  if (className) output.className = className;

  return output;
}

function equal(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function shortHex(value: string): string {
  return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}
