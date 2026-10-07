import { readdirSync } from 'node:fs';
import path from 'node:path';

export function findContractFiles(root) {
  const contracts = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      contracts.push(...findContractFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.contract.ts')) {
      contracts.push(entryPath);
    }
  }

  return contracts.sort((left, right) => left.localeCompare(right, 'en'));
}

export function resolveTsxCli(appRoot) {
  return path.join(appRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
}
