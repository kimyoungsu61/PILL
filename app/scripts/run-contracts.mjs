import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findContractFiles, resolveTsxCli } from './run-contracts-lib.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const contracts = findContractFiles(path.join(appRoot, 'src'));

if (contracts.length === 0) {
  console.error('No TypeScript contract files were found.');
  process.exit(1);
}

const tsxCli = resolveTsxCli(appRoot);
for (const contract of contracts) {
  const relativePath = path.relative(appRoot, contract);
  console.log(`> ${relativePath}`);

  const result = spawnSync(process.execPath, [tsxCli, relativePath], {
    cwd: appRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`Unable to run ${relativePath}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`${contracts.length} contract files passed.`);
