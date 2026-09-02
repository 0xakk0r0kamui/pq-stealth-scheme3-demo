import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const demoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = resolve(demoRoot, '../kohaku-sapq/crates/pq-stealth-ts');
const vendorDirectory = resolve(demoRoot, 'vendor');
const packageArchive = resolve(vendorDirectory, 'pq-stealth-scheme3.tgz');

mkdirSync(vendorDirectory, { recursive: true });
rmSync(packageArchive, { force: true });
run(['pnpm@10.28.0', 'run', 'build'], packageRoot);
run(['pnpm@10.28.0', 'pack', '--pack-destination', vendorDirectory], packageRoot);

const archives = readdirSync(vendorDirectory)
  .filter((name) => name.startsWith('kohaku-eth-pq-stealth-scheme3-') && name.endsWith('.tgz'));

if (archives.length !== 1) {
  throw new Error(`Expected one Scheme 3 package archive, found ${archives.length}`);
}

renameSync(resolve(vendorDirectory, archives[0]), packageArchive);
run(['pnpm@10.28.0', 'install', '--frozen-lockfile=false'], demoRoot);

function run(arguments_, cwd) {
  const result = spawnSync('corepack', arguments_, { cwd, stdio: 'inherit' });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
