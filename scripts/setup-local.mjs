import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../.local/docker/', import.meta.url));
fs.mkdirSync(directory, { recursive: true });
for (const [name, value] of [
  ['MYSQL_ROOT_PASSWORD', crypto.randomBytes(32).toString('hex')],
  ['PILL_DB_PASSWORD', crypto.randomBytes(32).toString('hex')],
  ['GEMINI_API_KEY', process.env.GEMINI_API_KEY || ''],
]) {
  const file = path.join(directory, name);
  try {
    fs.writeFileSync(file, value, { flag: 'wx', mode: 0o600 });
    console.log(`${name}: local configuration created`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`${name}: existing configuration retained`);
  }
}
console.log('Run: docker compose -f compose.local.yaml up --build --detach --wait');
