import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { findContractFiles, resolveTsxCli } from './run-contracts-lib.mjs';

test('findContractFiles returns nested contract files in stable order', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pill-contracts-'));

  try {
    await mkdir(path.join(root, 'nested'));
    await writeFile(path.join(root, 'z.contract.ts'), '');
    await writeFile(path.join(root, 'nested', 'a.contract.ts'), '');
    await writeFile(path.join(root, 'nested', 'ignored.ts'), '');

    assert.deepEqual(findContractFiles(root), [
      path.join(root, 'nested', 'a.contract.ts'),
      path.join(root, 'z.contract.ts'),
    ]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('findContractFiles returns an empty list for an empty directory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pill-contracts-'));

  try {
    assert.deepEqual(findContractFiles(root), []);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test('resolveTsxCli returns the installed JavaScript entry point', () => {
  assert.equal(
    resolveTsxCli('/app'),
    path.join('/app', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  );
});
