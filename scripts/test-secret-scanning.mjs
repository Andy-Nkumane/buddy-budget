import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const image =
  'zricethezav/gitleaks@sha256:e1b35e12a8c6fa8901f060459cfb6b2fc4c484d3afbe3b029733a3bbfab07055';
const fixtureRoot = mkdtempSync(join(tmpdir(), 'buddy-budget-gitleaks-'));
const configPath = resolve('.gitleaks.toml');
const positiveDirectory = join(fixtureRoot, 'positive');
const negativeDirectory = join(fixtureRoot, 'negative');

mkdirSync(positiveDirectory);
mkdirSync(negativeDirectory);

const fakeAccessKey = ['AKIA', '7KQ9M2X4V8C6N3RP'].join('');
writeFileSync(
  join(positiveDirectory, 'representative.env'),
  `AWS_ACCESS_KEY_ID=${fakeAccessKey}\n`,
);
writeFileSync(
  join(negativeDirectory, 'benign.txt'),
  'Synthetic artifact digest: 8f14e45fceea167a5a36dedd4bea2543b37c12fae238a66a2f6f9f85f97f471a\n',
);

const scan = (directory) =>
  spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '--volume',
      `${directory}:/fixture:ro`,
      '--volume',
      `${configPath}:/config/.gitleaks.toml:ro`,
      image,
      'dir',
      '/fixture',
      '--config=/config/.gitleaks.toml',
      '--redact',
      '--no-banner',
      '--exit-code=1',
    ],
    { encoding: 'utf8' },
  );

try {
  const positive = scan(positiveDirectory);
  if (positive.error) throw positive.error;
  if (positive.status !== 1) {
    throw new Error(
      `Expected the representative fake credential to be detected; exit ${positive.status}.`,
    );
  }

  const negative = scan(negativeDirectory);
  if (negative.error) throw negative.error;
  if (negative.status !== 0) {
    throw new Error(`Expected the benign high-entropy fixture to pass; exit ${negative.status}.`);
  }

  console.log('Secret scanner fixtures passed: fake credential detected; benign digest accepted.');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
