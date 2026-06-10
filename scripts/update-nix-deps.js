import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const flakeNixPath = resolve(root, 'flake.nix');

// Attempt to build the npmDeps derivation. If the hash in flake.nix is correct
// the build succeeds and there is nothing to do. If it is wrong, nix reports a
// "hash mismatch" error that includes the correct hash on the "got:" line.
const result = spawnSync(
  'nix',
  ['build', '.#packages.x86_64-linux.default.npmDeps', '--no-link'],
  { encoding: 'utf8', cwd: root },
);

if (result.error) {
  console.error(`Failed to run nix build: ${result.error.message}`);
  process.exit(1);
}

if (result.status === 0) {
  console.log('npmDepsHash is already up-to-date');
  process.exit(0);
}

const stderr = result.stderr;

if (!stderr.includes('hash mismatch')) {
  console.error('Unexpected nix build failure:');
  console.error(stderr);
  process.exit(1);
}

const match = stderr.match(/got:\s+(sha256-\S+)/);
if (!match) {
  console.error('Could not extract hash from nix build output:');
  console.error(stderr);
  process.exit(1);
}

const newHash = match[1];

const flakeNix = readFileSync(flakeNixPath, 'utf8');
const updated = flakeNix.replace(/npmDepsHash\s*=\s*"[^"]*"/, `npmDepsHash = "${newHash}"`);

if (updated === flakeNix) {
  console.error('npmDepsHash field not found in flake.nix');
  process.exit(1);
}

writeFileSync(flakeNixPath, updated, 'utf8');
console.log(`Updated npmDepsHash to ${newHash}`);
