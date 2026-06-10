/**
 * Rewrites electron-builder update metadata files (latest.yml, latest-mac.yml, latest-linux.yml)
 * to use static S3 paths instead of versioned filenames, and optionally injects GitHub release notes.
 *
 * Electron-builder generates paths like "Polkadot Desktop-1.0.0-x64.exe" but we upload
 * to static paths like "Polkadot-Desktop.exe" for the /latest/ directory.
 *
 * When GITHUB_TOKEN and VERSION env vars are set, fetches release notes from GitHub API
 * and injects them into the metadata for display in the updater dialog.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import yaml from 'js-yaml';

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || 'artifacts';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const VERSION = process.env.VERSION;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

const PATH_MAPPINGS = [
  [/Polkadot Desktop-[^\s]+-x64\.exe/g, 'Polkadot-Desktop.exe'],
  [/Polkadot Desktop-[^\s]+-x64\.dmg/g, 'Polkadot-Desktop-x64.dmg'],
  [/Polkadot Desktop-[^\s]+-arm64\.dmg/g, 'Polkadot-Desktop-arm64.dmg'],
  [/Polkadot Desktop-[^\s]+-x64\.zip/g, 'Polkadot-Desktop-x64.zip'],
  [/Polkadot Desktop-[^\s]+-arm64\.zip/g, 'Polkadot-Desktop-arm64.zip'],
  [/Polkadot Desktop-[^\s]+-x86_64\.AppImage/g, 'Polkadot-Desktop-x86_64.AppImage'],
  [/Polkadot Desktop-[^\s]+-arm64\.AppImage/g, 'Polkadot-Desktop-arm64.AppImage'],
];

function rewritePaths(content) {
  let result = content;
  for (const [pattern, replacement] of PATH_MAPPINGS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

async function fetchGitHubReleaseNotes() {
  if (!GITHUB_TOKEN || !VERSION || !GITHUB_REPOSITORY) {
    return null;
  }
  const tag = VERSION.startsWith('v') ? VERSION : `v${VERSION}`;
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/tags/${tag}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    console.warn(`[update-metadata] Failed to fetch release notes: ${response.status}`);
    return null;
  }
  const release = await response.json();
  return release.body?.trim() || null;
}

const METADATA_FILES = [
  'latest.yml',
  'latest-mac.yml',
  'latest-linux.yml',
  'latest-linux-x64.yml',
  'latest-linux-arm64.yml',
];

const releaseNotes = await fetchGitHubReleaseNotes();
if (releaseNotes) {
  console.log('[update-metadata] Injected GitHub release notes');
}

for (const filename of METADATA_FILES) {
  const filepath = join(ARTIFACTS_DIR, filename);
  try {
    let content = readFileSync(filepath, 'utf8');
    content = rewritePaths(content);

    if (releaseNotes) {
      const parsed = yaml.load(content);
      parsed.releaseNotes = releaseNotes;
      content = yaml.dump(parsed, { lineWidth: -1 });
    }

    writeFileSync(filepath, content);
    console.log(`[update-metadata] Rewrote ${filename}`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[update-metadata] Skipping ${filename} (not found - built on different OS)`);
    } else {
      throw err;
    }
  }
}
